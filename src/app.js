import express, { urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//Import routes
import userRouter from "./routes/userRoutes.js";

//Use routes
app.use("/api/v1/users", userRouter);
// app.get("/users", (req, res) => {
//     res.send("hello");
// });

export { app };
