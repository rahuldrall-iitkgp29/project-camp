import { validationResult } from "express-validator";
import { ApiError } from "../utils/apiError.js";



export const validate = (req , res , next)=>{
    const errors = validationResult(req) // this is a custom validtore which pass our req and throw an string of all error
    if(errors.isEmpty()){//if string is empty means no error
        return next()
    }
    const extractedErrors = []
    errors.array().map((err) => extractedErrors.push( //we make that string to array and push them into an new array where we separately and nicely see each error
        {
            [err.path] : err.msg 
        }//we are pushing an object into it which have path and value both of that error's
    ));
    throw new ApiError(422,"recevied data is not valid",extractedErrors);
};
