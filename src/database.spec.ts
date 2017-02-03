import sequelize from 'sequelize';
import 'should';

import { Database } from './database';
import { model, attr, assoc } from './model';
import * as squell from './index';

@model('actor', { tableName: 'actors' })
class Actor extends squell.Model {
  @attr(squell.STRING)
  public name: string;

  @assoc(squell.HAS_ONE, Actor)
  public mentee: Actor;

  @assoc(squell.BELONGS_TO, Actor)
  public mentor: Actor;
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
      options.modelName.should.equal('actor');
      return options.tableName.should.equal('actors');
    });

    it('should generate model attributes', () => {
      // TODO actually check the sequelize model for proof
      let attrs = db.getModelAttributes(Actor);
      attrs.name.should.exist;
    });

    it('should generate model associations', () => {
      // TODO actually check the sequelize model for proof
      let assocs = db.getModelAssociations(Actor);
      assocs.mentor.should.exist;
      return assocs.mentee.should.exist;
    });
  });
});
