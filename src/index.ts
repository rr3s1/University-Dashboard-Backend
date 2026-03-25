import express from "express";

const app = express();

// Parse incoming JSON bodies.
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).send("University Dashboard API is running.");
});

const port = 8000;
const url = `http://localhost:${port}`;

app.listen(port, () => {
  console.log(`Server started at ${url}`);
});

