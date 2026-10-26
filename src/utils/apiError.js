class ApiError extends Error {
  // by extends error we transfer all the property of built in error to ApiError also with allowing to add additional propertys to it
  constructor(
    statusCode,
    meassage = "Something went wrong", // we are keep on changing it
    errors = [], // we keep all our coming error into this array
    stack = "",
  ) {
    super(meassage);
    //super means call the constructor of parent class , in our case its Error
    // bcz ApiError extends Error means ApiError is a child of error who iheritate all the functinality of parent class (Error) with his own abilitys
    // later we store that in message using this.message
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;
    this.message = meassage;

    if (stack) {
      this.stack = stack; // if we have an stack trace thrown by our error then we use that
    } else {
      Error.captureStackTrace(this, this.constructor); //otherwise we automatically trace an default stack trace and create them in our constructor
    }
  }
}

export { ApiError };
