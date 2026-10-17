import User  from "../models/user.models.js";
import { ApiRespones} from "../utils/apiResponse.js"
import { ApiError } from "../utils/apiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import {emailVerficationMailgenContent, forgotPasswordMailgenContent, sendingEmail} from "../utils/mail.utils.js"
import jwt from "jsonwebtoken"
import crypto from "crypto";


const genAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        //now whichever user we want to access stores in [user]
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false }) // saving refreshToken
        return {accessToken , refreshToken}
    } catch (error) {
        console.error("genAccessAndRefreshToken Error:", error);
        throw new ApiError(500 , "Something went wrong wile generated access token")
    }
}


const registerUser = asyncHandler(async (req,res)=>{
    const {email , username , password , role } = req.body //data is come from body(we assume it from our frontend)

    const existedUser = await User.findOne({
        $or : [{username} , {email}] //if we find email or username in our db we don't register uer     
    })

    if(existedUser){
        throw new  ApiError(404,"username/email is already exist" , [])
    }


    //if we dont find an user
    const user = await User.create({ //also all functionallity we write in User is available in user also 
        email,
        password,
        username,
        isEmailVerified : false
    })

    const {unhashedToken, hashedToken, tokenExpiry} = user.genrateTemporaryToken()


    user.emailVerficationToken = hashedToken;
    user.emailVerficationTokenExpiry = tokenExpiry;
    await user.save({validateBeforeSave : false});

    await sendingEmail(
        {//these our options
            email : user?.email,
            subject: "Please verify your email",
            mailgenContent : emailVerficationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unhashedToken}` //dynamic links/url
            ),
        }
    );

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerficationToken -emailVerficationTokenExpiry",
    )

    if(!createdUser){
        throw new ApiError(500 , "smt went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiRespones(
            200,
            {user : createdUser},
            "user registered successfully and verification email has been sent on your email",
        )
    )
});

const login = asyncHandler(async (req,res)=>{
    const {email , password ,username} = req.body

    if(!username || !email) throw new ApiError(400,"email and username is req");
    
    const user = await User.findOne({email});// we do an email based login

    if(!user) throw new ApiError(400,"user not exist");//empty means its not found in db

    const passValid = await user.isPasswordCorrect(password); //from user models

    if(!passValid) throw new ApiError(400,"password not correct");

    const {accessToken , refreshToken} = await genAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerficationToken -emailVerficationTokenExpiry",
    )

    if(!loggedInUser){
        throw new ApiError(500 , "smt went wrong while logging the user")
    }

    //COOKIES
    const options = { 
        httpOnly : true,
        secure : true // now only browser can manuplate cookies
    }

    return res
        .status(200)
        .cookie("accessToken" , accessToken , options)
        .cookie("refreshToken" , refreshToken , options) // we send them as cookies
        .json(//our json response
            new ApiRespones(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User login successfully"
            )
        )

})

const logoutUser = asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        //we creste .user in req under middleware and store some data there
        //we find user by this id and make follow changes there
        {
            $set: {
                refreshToken: "" //ref token empty on logout
            }
        },
        {
            new: true,//once evrything is done give me most updated/new object
        },
    );
    const options = {
        httpOnly : true,
        secure : true
    }
    return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)//remove all cookies
        .json(
            new ApiRespones(200,{},"user is logout successfully")
        )
})

const getCurrentUser = asyncHandler(async(req,res)=>{//getting current user info(secured)
    return res
        .status(200)
        .json(
            new ApiRespones(
                200,
                req.user,
                "Current user successfully"
            )
        );
})

const verifyEmail = asyncHandler(async(req,res)=>{//verification of sended token via email
    const {verficationToken} = req.params//params give access to url and we have our token inside that url to verify
    
    if(!verficationToken){
        throw new ApiError(400,'dont have email verification token')
    }

    let hashedToken = crypto
                        .createHash("sha256")
                        .update(verficationToken)
                        .digest("hex")

    const user = await User.findOne({
        emailVerficationToken : hashedToken,
        emailVerficationTokenExpiry : {$gt : Date.now()} //grater then
    })

    if(!user){
        throw new ApiError(400,'token is verified or invalid')
    }

    user.emailVerficationToken = undefined
    user.emailVerficationTokenExpiry = undefined //thes data are usless after verification , so it make not sense to save it

    user.isEmailVerified = true
    await user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(
            new ApiRespones(
                200,
                {
                    isEmailVerified : true
                },
                "email is verified"
            )
        )
})

const resendEmailVerification = asyncHandler(async(req,res)=>{
    const user = await User.findById(req.user?._id)

    if(!user){//we need user to register first to resend token
        throw new ApiError(404,"user does not exist")
    }
    if(user.isEmailVerified){
        throw new ApiError(409,"email is already verified")
    }

    const {unhashedToken, hashedToken, tokenExpiry} = user.genrateTemporaryToken()

    user.emailVerficationToken = hashedToken;
    user.emailVerficationTokenExpiry = tokenExpiry;
    await user.save({validateBeforeSave : false});

    await sendingEmail(
        {//these our options
            email : user?.email,
            subject: "Please verify your email",
            mailgenContent : emailVerficationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unhashedToken}` //dynamic links/url
            ),
        }
    );


    return res
        .status(200)
        .json(
            new ApiRespones(
                200,
                {},
                "email has been sent successfully to your email id"
            )
        )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    //refreshing access token using ref token after its expiry
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized access")
    }

    try {
        const decodedRefreshToken = jwt.verify(incomingRefreshToken , process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedRefreshToken?._id);

        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"refresh token is expired")
        }

        const options = {
            httpOnly : true,
            secure : true
        }

        const {accessToken , refreshToken : newRefreshToken} = await genAccessAndRefreshToken(user._id)

        user.refreshToken = newRefreshToken //actually we cast this thing with this name above
        await user.save()

        return res
            .status(200)
            .cookie("accessToken" , accessToken , options)
            .cookie("refreshToken" , newRefreshToken , options)
            .json(
                new ApiRespones(
                    200,
                    {
                        accessToken,
                        refrershToken : newRefreshToken
                    },
                    "Acess token refreshed"
                )
            )

    } catch (error) {
        throw new ApiError(401,"Invalid refresh token");
        console.log(error)
    }

})

const forgotPasswordRequest = asyncHandler(async(req,res)=>{
    const {email} = req.body 

    const user = await User.findOne({email})

    if(!user){
        throw new ApiError(404,"User is not exist")
    }

    const {unhashedToken , hashedToken , tokenExpiry} = user.genrateTemporaryToken()

    user.forgotPasswordToken = hashedToken
    user.forgotPasswordTokenExpiry = tokenExpiry

    await user.save({validateBeforeSave : false})

    await sendingEmail(
        {//these our options
            email : user?.email,
            subject: "Password reset request",
            mailgenContent : forgotPasswordMailgenContent(
                user.username,
                `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unhashedToken}`,
            ),
        }
    );

    return res 
        .status(200)
        .json(
            new ApiRespones(
                200,
                {},
                "Password reset mail is send on your email id"
            )
        )
})

const resetForgotPassword = asyncHandler(async(req,res)=>{
    const {resetToken} = req.params
    const {newPassword} = req.body 

    let hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex")

    const user = await User.findOne({
        forgotPasswordToken : hashedToken,
        forgotPasswordTokenExpiry : {$gt : Date.now()}
    })

    if(!user){
        throw new ApiError(489,"token invalid or expired")
    }

    user.forgotPasswordToken = undefined
    user.forgotPasswordTokenExpiry = undefined

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res
        .status(200)
        .json(
            new ApiRespones(
                200,
                {},
                "Password reset successfully"
            )
        )
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{//changing pass for person who already logged in
    const {oldPassword , newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid) {
        throw new ApiError(400,"invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res
        .status(200)
        .json(
            new ApiRespones(
                200,
                {},
                "password channged successfully"
            )
        )
})

export { 
    login, 
    registerUser,
    logoutUser, 
    getCurrentUser, 
    verifyEmail,
    resendEmailVerification,
    forgotPasswordRequest,
    resetForgotPassword,
    changeCurrentPassword,
    refreshAccessToken
};