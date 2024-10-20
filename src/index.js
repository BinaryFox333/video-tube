import dotenv from "dotenv";
import connectDB from "./db/connectDB.js";
import express, { urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

connectDB()
    .then(() => {
        app.listen(process.env.PORT, () => {
            console.log(`Server listening on ${process.env.PORT}`);
        });
    })
    .catch((error) => {
        console.log("Database connection failed: " + error.message);
    });
