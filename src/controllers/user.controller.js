import asyncHandler from "express-async-handler";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId).select("-password");
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: true });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, error?.message || "Error generating tokens");
    }
};

export const registerUser = asyncHandler(async (req, res) => {
    const { username, email, fullName, password } = req.body;
    // Check for empty fields
    if (
        [username, email, fullName, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Check for existing users
    const existingUser = await User.findOne({
        $or: [{ username }, { email }],
    });
    if (existingUser) {
        throw new ApiError(
            409,
            existingUser.username === username
                ? "Username already exists"
                : "Email already exists"
        );
    }

    // Uploading files to cloudinary
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(500, "Error uploading avatar to cloudinary");
    }

    //Create user
    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    if (!createdUser) {
        throw new ApiError(500, "Error registering user");
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, createdUser, "User registered successfully")
        );
});

export const loginUser = asyncHandler(async (req, res) => {
    //Get data from user
    const { username, email, password } = req.body;

    //Validate data
    if (!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }
    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    //Authentication
    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Incorret password");
    }

    //Generate access & refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

    // console.log(generateAccessAndRefreshTokens(user._id));

    //set cookies and send response
    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json({
            user: user,
            refreshToken,
            accessToken,
        });
});

export const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1, // this removes the field from document
            },
        },
        {
            new: true,
        }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
    // Get the refresh token from the request
    const currentRefreshToken =
        req.body.refreshToken || req.cookies.refreshToken;
    if (!currentRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        // Verify the refresh token
        const decodedUser = jwt.verify(
            currentRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );
        const user = await User.findById(decodedUser?._id);

        if (!user) {
            throw new ApiError(401, "Invalid token");
        }

        //refresh tokens
        const { accessToken, refreshToken: newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        //send the new tokens
        const options = {
            httpOnly: true,
            secure: true,
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json({
                user: user,
                accessToken,
                refreshToken: newRefreshToken,
                message: "Access token refreshed successfully",
            });
    } catch (error) {
        throw new ApiError(500, error?.message || "Error refreshing tokens");
    }
});

export const changePassword = asyncHandler(async (req, res) => {
    // Get the new password
    const { oldPassword, newPassword } = req.body;
    // console.log(req.body);
    // console.log(req.user);
    const user = await User.findById(req.user?._id);

    // Check if the old password is correct
    const isPasswordValid = await user.comparePassword(oldPassword);
    if (!isPasswordValid) {
        throw new ApiError(401, "Incorrect old password");
    }

    //update password
    user.password = newPassword;
    await user.save();

    // send respones
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password updated successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "user fetched successfully"));
});

export const updateAccountDetails = asyncHandler(async (req, res) => {
    // Get the updated details
    const { username, fullName, email } = req.body;
    // console.log(req.body);
    if (!username || !fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                username: username.toLowerCase(),
                fullName,
                email,
            },
        },
        {
            new: true,
        }
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully")
        );
});

export const updateAvatar = asyncHandler(async (req, res) => {
    // console.log(req.file);
    //Get avatar local path
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }
    // Upload avatar to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) {
        throw new ApiError(500, "Error uploading avatar to cloudinary");
    }

    // Update user avatar
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        {
            new: true,
        }
    ).select("-password");

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user,
            },
            "Avatar updated successfully!"
        )
    );
});

export const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }
    // Upload avatar to cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage) {
        throw new ApiError(500, "Error uploading avatar to cloudinary");
    }

    // Update user avatar
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            },
        },
        {
            new: true,
        }
    ).select("-password");

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user,
            },
            "coverImage updated successfully!"
        )
    );
});

export const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username) {
        throw new ApiError(400, "Username is required");
    }
    // console.log(username);

    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase(),
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedChannels",
            },
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                subscribedChannelsCount: { $size: "$subscribedChannels" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers._id"] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                subscribedChannelsCount: 1,
                isSubscribed: 1,
            },
        },
    ]);

    // console.log(channel);
    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                channel: channel[0],
            },
            "Channel profile fetched successfully!"
        )
    );
});

export const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner",
                            },
                        },
                    },
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch history fetched successfully"
            )
        );
});
