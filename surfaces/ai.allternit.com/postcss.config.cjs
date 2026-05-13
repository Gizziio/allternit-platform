module.exports = {
  plugins: {
    tailwindcss: {},
    // flexbox: false suppresses the autoprefixer warning from ag-grid-community/styles/ag-grid.css
    // which uses non-prefixed `end` alignment values. We target modern browsers only.
    autoprefixer: { flexbox: false },
  },
};
