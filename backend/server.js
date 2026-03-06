require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const apiRoutes = require("./routes");

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
  })
);
app.use(express.json({ limit: "2mb" }));

app.use("/api", apiRoutes);

app.use((err, _req, res, _next) => {
  return res.status(500).json({ message: err.message || "Internal server error" });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Payroll backend running on port ${port}`);
});
