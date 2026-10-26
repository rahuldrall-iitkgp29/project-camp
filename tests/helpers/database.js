import mongoose from "mongoose";

export const clone = (value) =>
  value == null ? value : JSON.parse(JSON.stringify(value));
const get = (doc, key) =>
  key.split(".").reduce((value, part) => value?.[part], doc);
const set = (doc, key, value) => {
  const parts = key.split(".");
  const last = parts.pop();
  const target = parts.reduce((value, part) => (value[part] ??= {}), doc);
  target[last] = clone(value);
};
const equals = (left, right) => String(left) === String(right);
export const matches = (doc, filter = {}) =>
  Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some((item) => matches(doc, item));
    if (key === "$and") return value.every((item) => matches(doc, item));
    const actual = get(doc, key);
    if (
      value &&
      typeof value === "object" &&
      !mongoose.isObjectIdOrHexString(value) &&
      !(value instanceof Date)
    ) {
      return Object.entries(value).every(([operator, expected]) => {
        if (operator === "$in")
          return expected.some((item) => equals(actual, item));
        if (operator === "$gt")
          return new Date(actual).getTime() > new Date(expected).getTime();
        if (operator === "$exists") return (actual !== undefined) === expected;
        if (operator === "$ne") return !equals(actual, expected);
        throw new Error(`Unsupported test filter: ${operator}`);
      });
    }
    return value == null ? actual == null : equals(actual, value);
  });

const project = (doc, projection = {}) => {
  if (!doc) return null;
  const inclusive = Object.values(projection).some(
    (value) => value === 1 || typeof value === "object",
  );
  const result = inclusive
    ? projection._id === 0
      ? {}
      : { _id: doc._id }
    : clone(doc);
  for (const [key, included] of Object.entries(projection)) {
    if (!included) {
      const parts = key.split(".");
      const last = parts.pop();
      const target = parts.reduce((value, part) => value?.[part], result);
      if (target) delete target[last];
    } else if (typeof included === "object")
      result[key] = project(doc[key], included);
    else if (get(doc, key) !== undefined) set(result, key, get(doc, key));
  }
  return result;
};

// Minimal collection adapter, deliberately throws for unsupported operations.
// Serialized mock transactions test rollback intent, not MongoDB isolation behavior.
export function installDatabase(mock, models) {
  const state = {
    tables: {},
    calls: [],
    failNext: null,
    beforeTransaction: null,
    transactions: 0,
  };
  for (const model of models) state.tables[model.collection.name] = [];
  const check = (name, method, args) => {
    state.calls.push({ name, method, args: clone(args) });
    if (state.failNext?.name === name && state.failNext?.method === method) {
      state.failNext = null;
      throw new Error("Injected database failure");
    }
  };
  const expression = (doc, value) => {
    if (typeof value === "string" && value.startsWith("$"))
      return get(doc, value.slice(1));
    if (value?.$size) return expression(doc, value.$size).length;
    if (value?.$arrayElemAt)
      return expression(doc, value.$arrayElemAt[0])[value.$arrayElemAt[1]];
    throw new Error("Unsupported test aggregation expression");
  };
  const aggregate = (input, pipeline) => {
    let result = clone(input);
    for (const stage of pipeline) {
      if (stage.$match)
        result = result.filter((doc) => matches(doc, stage.$match));
      else if (stage.$lookup) {
        const {
          from,
          localField,
          foreignField,
          as,
          pipeline: nested = [],
        } = stage.$lookup;
        result = result.map((doc) => ({
          ...doc,
          [as]: aggregate(
            state.tables[from].filter((other) =>
              equals(get(doc, localField), get(other, foreignField)),
            ),
            nested,
          ),
        }));
      } else if (stage.$unwind)
        result = result.flatMap((doc) =>
          (get(doc, stage.$unwind.slice(1)) || []).map((value) => ({
            ...doc,
            [stage.$unwind.slice(1)]: value,
          })),
        );
      else if (stage.$addFields)
        result = result.map((doc) => {
          for (const [key, value] of Object.entries(stage.$addFields))
            doc[key] = expression(doc, value);
          return doc;
        });
      else if (stage.$project)
        result = result.map((doc) => project(doc, stage.$project));
      else throw new Error("Unsupported test aggregation stage");
    }
    return result;
  };
  const apply = (doc, update, inserting = false) => {
    if (inserting)
      for (const [key, value] of Object.entries(update.$setOnInsert || {}))
        set(doc, key, value);
    for (const [key, value] of Object.entries(update.$set || {}))
      set(doc, key, value);
    for (const key of Object.keys(update.$unset || {})) delete doc[key];
    for (const [key, value] of Object.entries(update.$inc || {}))
      set(doc, key, (get(doc, key) || 0) + value);
    for (const [key, value] of Object.entries(update.$push || {})) {
      doc[key] ??= [];
      doc[key].push(...clone(value.$each || [value]));
    }
    for (const operator of Object.keys(update))
      if (
        !["$set", "$unset", "$inc", "$push", "$setOnInsert"].includes(operator)
      )
        throw new Error(`Unsupported test update: ${operator}`);
  };
  for (const model of models) {
    const name = model.collection.name;
    const table = () => state.tables[name];
    const unique = (doc) => {
      for (const [fields, options] of model.schema.indexes()) {
        if (
          options.unique &&
          table().some(
            (other) =>
              !equals(other._id, doc._id) &&
              Object.keys(fields).every((field) =>
                equals(get(doc, field), get(other, field)),
              ),
          )
        ) {
          throw Object.assign(new Error("Duplicate"), { code: 11000 });
        }
      }
    };
    mock.method(model.collection, "insertOne", async (doc, options) => {
      check(name, "insertOne", [doc, options]);
      unique(doc);
      table().push(clone(doc));
      return { acknowledged: true, insertedId: doc._id };
    });
    mock.method(model.collection, "findOne", async (filter, options = {}) => {
      check(name, "findOne", [filter, options]);
      return project(
        table().find((doc) => matches(doc, filter)),
        options.projection,
      );
    });
    mock.method(model.collection, "find", (filter = {}, options = {}) => {
      check(name, "find", [filter, options]);
      let docs = table().filter((doc) => matches(doc, filter));
      if (options.limit) docs = docs.slice(0, options.limit);
      return {
        toArray: async () =>
          docs.map((doc) => project(doc, options.projection)),
      };
    });
    mock.method(model.collection, "countDocuments", async (filter) => {
      check(name, "countDocuments", [filter]);
      return table().filter((doc) => matches(doc, filter)).length;
    });
    mock.method(model.collection, "aggregate", (pipeline) => {
      check(name, "aggregate", [pipeline]);
      return { toArray: async () => aggregate(table(), pipeline) };
    });
    for (const method of ["updateOne", "updateMany", "findOneAndUpdate"])
      mock.method(
        model.collection,
        method,
        async (filter, update, options = {}) => {
          check(name, method, [filter, update, options]);
          let docs = table().filter((doc) => matches(doc, filter));
          if (method !== "updateMany") docs = docs.slice(0, 1);
          let inserting = false;
          if (!docs.length && options.upsert) {
            const doc = { _id: new mongoose.Types.ObjectId().toString() };
            for (const [key, value] of Object.entries(filter))
              if (
                !key.startsWith("$") &&
                (typeof value !== "object" ||
                  mongoose.isObjectIdOrHexString(value))
              )
                doc[key] = clone(value);
            docs = [doc];
            inserting = true;
          }
          const previous = clone(docs[0]);
          for (const doc of docs) {
            apply(doc, update, inserting);
            unique(doc);
            if (inserting) table().push(doc);
          }
          if (method === "findOneAndUpdate")
            return project(
              options.returnDocument === "after" ? docs[0] : previous,
              options.projection,
            );
          return {
            acknowledged: true,
            matchedCount: inserting ? 0 : docs.length,
            modifiedCount: docs.length,
            ...(inserting ? { upsertedId: docs[0]._id } : {}),
          };
        },
      );
    for (const method of ["deleteOne", "deleteMany", "findOneAndDelete"])
      mock.method(model.collection, method, async (filter, options) => {
        check(name, method, [filter, options]);
        let docs = table().filter((doc) => matches(doc, filter));
        if (method !== "deleteMany") docs = docs.slice(0, 1);
        state.tables[name] = table().filter((doc) => !docs.includes(doc));
        return method === "findOneAndDelete"
          ? clone(docs[0] || null)
          : { acknowledged: true, deletedCount: docs.length };
      });
  }
  let previous = Promise.resolve();
  mock.method(mongoose, "startSession", async () => {
    const session = {
      endSession: async () => {},
      withTransaction: (work) => {
        const running = previous.then(async () => {
          state.transactions++;
          if (state.beforeTransaction) {
            const action = state.beforeTransaction;
            state.beforeTransaction = null;
            action();
          }
          const snapshot = clone(state.tables);
          try {
            return await work();
          } catch (error) {
            state.tables = snapshot;
            throw error;
          }
        });
        previous = running.catch(() => {});
        return running;
      },
    };
    return session;
  });
  mock.method(mongoose, "connect", () => {
    throw new Error("Live database access is forbidden in mock tests");
  });
  return state;
}
