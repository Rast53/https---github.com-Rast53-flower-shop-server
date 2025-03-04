'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Categories" RENAME TO "categories";
      ALTER TABLE "Flowers" RENAME TO "flowers";
      ALTER TABLE flowers 
        DROP CONSTRAINT IF EXISTS "flowers_category_id_fkey",
        ADD CONSTRAINT flowers_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES categories(id);
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE categories RENAME TO "Categories";
      ALTER TABLE flowers RENAME TO "Flowers";
    `);
  }
}; 