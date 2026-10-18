/*
every time user send access token and our server check it each
so rather every middleware verify our access token we write a middleware code who varify access token
*/
import User from "../models/user.models.js"
import {ProjectMember} from "../models/projectmember.models.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

export const verifyJWT = asyncHandler(async(req,res,next)=>{
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")  ;
    //if i got cokkie then access access token from it or from bearer tokens and replace it from bearer to nothing and then give it back


    if(typeof token !== "string" || !token){
        throw new ApiError(401,"unauthorized request")
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, { algorithms: ["HS256"] });
    } catch (error) {
        throw new ApiError(401,"Invalid access token")
    }
    if (!mongoose.isObjectIdOrHexString(decodedToken?._id)) {
        throw new ApiError(401, "Invalid access token");
    }
    const user = await User.findById(decodedToken._id).select(
        "-password -refreshToken -emailVerficationToken -emailVerficationTokenExpiry -forgotPasswordToken -forgotPasswordTokenExpiry -__v -avatar.localPath"
    );
    if (!user || (decodedToken.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
        throw new ApiError(401, "Invalid access token");
    }
    req.user = user.toObject();
    delete req.user.tokenVersion;
    next();
})

export const requireVerifiedEmail = (req, res, next) => {
    if (!req.user?.isEmailVerified) {
        throw new ApiError(403, "Verify your email before accessing projects");
    }
    next();
};

//writting middleware for our project controllers
//means diff user with diff role have diff access of doing things like deleting , adding , mark done ,etc 
// like delete project controller -> only access by admin not by regular user

export const validateProjectPermission = (roles = []) => { //we accept roles as array in this -> all inputs which are given in roles array have access to pass middleware and use contorller ,  rest all of them stopped here
    return asyncHandler(async(req,res,next) => {
        const {projectId} = req.params
        if(!projectId){
            throw new ApiError(400,"project id is missing")
        }
        if (!mongoose.isObjectIdOrHexString(projectId)) {
            throw new ApiError(400, "Invalid project id");
        }

        const project = await ProjectMember.findOne({
          project: new mongoose.Types.ObjectId(projectId),
          user: new mongoose.Types.ObjectId(req.user._id),
        });

        if (!project) {
          throw new ApiError(403, "You are not a member of this project");
        }

        const givenRole = project?.role 

        req.user.role = givenRole //we add a new prop in req which is role

        if(!roles.includes(givenRole)){ //if member who try to use that property is not have persmission(his role is not in input roles)
            throw new ApiError(
                403,
                "you are not allowed to perform this action"
            )
        }

        next(); //if member role pass above conditions then he was allow to use the property (he can get passed throw the middleware)
    });
};
