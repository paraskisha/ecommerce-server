import type { Core } from '@strapi/strapi';
const bcrypt = require('bcryptjs');

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const roleUID = 'plugin::users-permissions.role';
    const userUID = 'plugin::users-permissions.user';

    let role = await strapi.db.query(roleUID).findOne({
      where: { type: 'store-manager' },
    });

    if (!role) {
      role = await strapi.db.query(roleUID).create({
        data: {
          name: 'Store Manager',
          description: 'Can manage ShopKart products.',
          type: 'store-manager',
        },
      });
    } else if (role.name !== 'Store Manager') {
      role = await strapi.db.query(roleUID).update({
        where: { id: role.id },
        data: { name: 'Store Manager' },
      });
    }

    const actions = [
      'api::product.product.find',
      'api::product.product.findOne',
      'api::product.product.create',
      'api::product.product.update',
      'api::product.product.delete',
      'plugin::upload.file.upload',
      'plugin::users-permissions.user.me',
    ];

    for (const action of actions) {
      const existing = await strapi.db
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: { id: role.id } } });

      if (!existing) {
        await strapi.db.query('plugin::users-permissions.permission').create({
          data: { action, role: role.id },
        });
      }
    }

    let user = await strapi.db.query(userUID).findOne({
      where: { username: 'admin' },
      populate: ['role'],
    });

    const userData = {
      username: 'admin',
      email: 'admin@shopkart.local',
      password: 'admin321',
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: role.id,
    };

    const usersService = strapi.plugin('users-permissions').service('user');
    if (!user) {
      await usersService.add(userData);
      user = await strapi.db.query(userUID).findOne({
        where: { username: 'admin' },
      });
    } else {
      await usersService.edit(user.id, userData);
    }

    if (user) {
      await strapi.db.query(userUID).update({
        where: { id: user.id },
        data: {
          ...userData,
          password: await bcrypt.hash(userData.password, 10),
        },
      });
    }
  },
};
