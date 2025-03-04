module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('Categories', [
      {
        name: 'Розы',
        slug: 'rozy',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Тюльпаны',
        slug: 'tyulpany',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Categories', null, {});
  }
}; 