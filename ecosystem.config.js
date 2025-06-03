module.exports = {
  apps: [
    {
      name: "backend",
      script: "dist/index.js", // adjust if needed
      env: {
        PORT: 5000,
        NODE_ENV: "production",
      },
      restart_delay: 5000,
      watch: false,
    },
  ],
};
