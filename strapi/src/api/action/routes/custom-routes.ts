export default {
  routes: [
    {
      method: "POST",
      path: "/actions/execute",
      handler: "action.execute",
      config: {
        policies: [],
      },
    },
  ],
};
