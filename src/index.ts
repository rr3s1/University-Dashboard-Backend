import express from "express";
import subjectsRouter from "./routes/subjects";
import departmentsRouter from "./routes/departments";
import cors from "cors";
import authMiddleware from "./middleware/auth";
import securityMiddleware from "./middleware/security";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";

const app = express();

// CORS before security so OPTIONS preflight gets headers before Arcjet runs.
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Better Auth must run before express.json() — the JSON parser consumes the body
// and breaks the auth handler (see https://www.better-auth.com/docs/integrations/express).
app.all('/api/auth/{*splat}', toNodeHandler(auth));

app.use(express.json());

// Before auth/security so short-circuit responses (401/403/429) still get the header.
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
  }
  next();
});

app.use(authMiddleware);
app.use(securityMiddleware);

app.use("/api/subjects", subjectsRouter);
app.use("/api/departments", departmentsRouter);

app.get("/", (_req, res) => {
  res.status(200).send("University Dashboard API is running.");
});

const port = 8000;
const url = `http://localhost:${port}`;

app.listen(port, () => {
  console.log(`Server started at ${url}`);
});

