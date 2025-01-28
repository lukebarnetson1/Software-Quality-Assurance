module.exports = {
  isAuthenticated: (req, res, next) => {
    if (req.session.userId) {
      // User is logged in
      return next();
    }
    // Redirect to login if not authenticated
    return res.redirect("/auth/login");
  },
};
