import { Router } from "express";
import {
    loginUser,
    registerUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1,
        },
        {
            name: "coverImage",
            maxCount: 1,
        },
    ]),
    registerUser
);
router.route("/login").post(loginUser);
router.route("/logout").post(verifyToken, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").patch(verifyToken, changePassword);
router.route("/current-user").get(verifyToken, getCurrentUser);
router.route("/update-details").patch(verifyToken, updateAccountDetails);
router
    .route("/update-avatar")
    .patch(verifyToken, upload.single("avatar"), updateAvatar);
router
    .route("/update-coverimage")
    .patch(verifyToken, upload.single("coverImage"), updateCoverImage);
router.route("/get-channel/:username").get(verifyToken, getUserChannelProfile);
router.route("/get-history/:id").get(verifyToken, getWatchHistory);

export default router;
