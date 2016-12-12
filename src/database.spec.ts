import sequelize from 'sequelize';
import 'should';

import { Database } from './database';
import { attr, model } from './model';
import * as squell from './index';

@model('actor', { tableName: 'actors' })
class Actor extends squell.Model {
  @attr(squell.STRING)
  public name: string;
}

let db = new Database('sqlite://root:root@localhost/squell_test', {
  storage: '../test.db',
  logging: false
});

db.define(Actor);

describe('Database', () => {
  describe('#define', () => {
    it('should generate models', () => {
      let options = db.getModelOptions(Actor);
      let attrs = db.getModelAttributes(Actor);

      options.modelName.should.equal('actor');
      options.tableName.should.equal('actors');

      return attrs.name.should.exist;
    });
  });
});
