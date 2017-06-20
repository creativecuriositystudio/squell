/* tslint:disable:no-magic-numbers */
import 'should';
import * as sequelize from 'sequelize';
import * as modelsafe from 'modelsafe';

import { Database } from './database';
import { assoc, attr } from './metadata';
import { ASC, DESC } from './query';

/* tslint:disable:completed-docs */
@modelsafe.model()
class Actor extends modelsafe.Model {
  @attr({ autoIncrement: true })
  @modelsafe.attr(modelsafe.INTEGER, { primary: true })
  @modelsafe.optional
  id: number;

  @modelsafe.attr(modelsafe.STRING)
  public name: string;

  @modelsafe.attr(modelsafe.INTEGER)
  public age: number;

  @modelsafe.assoc(modelsafe.BELONGS_TO, Actor)
  public mentor: Actor;

  @modelsafe.assoc(modelsafe.HAS_ONE, () => Actor)
  public mentee: Actor;
}

@modelsafe.model()
class List extends modelsafe.Model {
  @attr({ autoIncrement: true })
  @modelsafe.attr(modelsafe.INTEGER, { primary: true })
  @modelsafe.optional
  id: number;

  @modelsafe.attr(modelsafe.STRING)
  public name: string;

  @assoc({ foreignKey: { allowNull: false, name: 'parentId' } })
  @modelsafe.assoc(modelsafe.HAS_MANY, () => ListItem)
  public items: ListItem[];
}

@modelsafe.model()
class ListItem extends modelsafe.Model {
  @attr({ autoIncrement: true })
  @modelsafe.attr(modelsafe.INTEGER, { primary: true })
  @modelsafe.optional
  id: number;

  @modelsafe.attr(modelsafe.STRING)
  public value: string;

  @assoc({ foreignKey: { allowNull: false, name: 'parentId' } })
  @modelsafe.assoc(modelsafe.BELONGS_TO, List)
  public parent: List;
}
/* tslint:enable-completed-docs */

let db = new Database('sqlite://root:root@localhost/squell_test', {
  storage: ':memory:',
  logging: !!process.env.LOG_TEST_SQL
});

db.define(Actor);
db.define(List);
db.define(ListItem);

describe('Query', () => {
  beforeEach(async () => {
    return db.sync({ force: true })
      .then(async () => {
        let bruce = new Actor();
        let milla = new Actor();
        let chris = new Actor();

        bruce.name = 'Bruce Willis';
        bruce.age = 61;

        milla.name = 'Milla Jojovich';
        milla.age = 40;

        chris.name = 'Chris Tucker';
        chris.age = 45;

        [bruce, milla, chris] = await db
          .query(Actor)
          .bulkCreate([bruce, milla, chris]);

        bruce.mentor = milla;
        milla.mentor = chris;
        chris.mentor = bruce;
        chris.mentee = milla;

        await db
          .query(Actor)
          .include(Actor, m => m.mentor)
          .include(Actor, m => m.mentee)
          .save(bruce);

        await db
          .query(Actor)
          .include(Actor, m => m.mentor)
          .include(Actor, m => m.mentee)
          .save(milla);

        await db
          .query(Actor)
          .include(Actor, m => m.mentor)
          .include(Actor, m => m.mentee)
          .save(chris);
      });
  });

  describe('#compileFindOptions', () => {
    it('should compile', () => {
      let options = db.query(Actor)
        .where(m => m.name.eq('Bruce Willis'))
        .attributes(m => [m.name])
        .order(m => [[m.name, DESC]])
        .take(5)
        .skip(5)
        .compileFindOptions();

      options.should.deepEqual({
        where: { name: 'Bruce Willis' },
        order: [['name', 'DESC']],
        attributes: [sequelize.col('name')],
        limit: 5,
        offset: 5
      });
    });
  });

  describe('#findOne', () => {
    it('should find by name', async () => {
      return db.query(Actor)
        .where(m => m.name.eq('Bruce Willis'))
        .findOne()
        .then((actor) => {
          actor.name.should.equal('Bruce Willis');
        });
    });
  });

  describe('#find', () => {
    it('should find less than 50 yos', async () => {
      return db.query(Actor)
        .where(m => m.age.lt(50))
        .find()
        .then((actors) => {
          actors.should.have.length(2);
        });
    });

    it('should find one 50 yo when taken', async () => {
      return db.query(Actor)
        .where(m => m.age.lt(50))
        .take(1)
        .find()
        .then((actors) => {
          actors.should.have.length(1);
        });
    });

    it('should find ordered correctly', async () => {
      return db.query(Actor)
        .order(m => [[m.age, ASC]])
        .find()
        .then((actors) => {
          actors[0].age.should.equal(40);
          actors[2].age.should.equal(61);
        });
    });
  });

  describe('#count', () => {
    it('should count all actors', async () => {
      return db.query(Actor)
        .count()
        .then((num) => {
          num.should.equal(3);
        });
    });

    it('should count two actors under 50 yo', async () => {
      return db.query(Actor)
        .where(m => m.age.lt(50))
        .count()
        .then((num) => {
          num.should.equal(2);
        });
    });
  });

  describe('#aggregate', () => {
    it('should average ages correctly', async () => {
      return db.query(Actor)
        .aggregate('AVG', m => m.age)
        .then((num) => {
          Math.ceil(num).should.equal(48);
        });
    });
  });

  describe('#min', () => {
    it('should find the minimum age', async () => {
      return db.query(Actor)
        .min(m => m.age)
        .then((num) => {
          num.should.equal(40);
        });
    });
  });

  describe('#max', () => {
    it('should find the maximum age', async () => {
      return db.query(Actor)
        .max(m => m.age)
        .then((num) => {
          num.should.equal(61);
        });
    });
  });

  describe('#sum', () => {
    it('should find the total age', async () => {
      return db.query(Actor)
        .sum(m => m.age)
        .then((num) => {
          num.should.equal(146);
        });
    });
  });

  describe('#truncate', () => {
    it('should clear the database table', async () => {
      return db.query(Actor)
        .truncate()
        .then(async () => {
          return db.query(Actor)
            .count()
            .then((num) => {
              num.should.equal(0);
            });
        });
    });
  });

  describe('#destroy', () => {
    it('should clear the database table', async () => {
      return db.query(Actor)
        .destroy()
        .then(async () => {
          return db.query(Actor)
            .count()
            .then((num) => {
              num.should.equal(0);
            });
        });
    });
  });

  describe('#save', () => {
    it('should create instances if no primary is set', async () => {
      let actor = new Actor();

      actor.name = 'Gary Oldman';
      actor.age = 58;

      return db.query(Actor)
        .save(actor)
        .then(created => {
          created.id.should.equal(4);
        });
    });

    it('should update instances if a primary is set', async () => {
      let actor = new Actor();

      actor.name = 'Gary Oldman';
      actor.age = 58;

      let created = await db.query(Actor).create(actor);

      created.id.should.equal(4);
      created.name = 'Barry Boldman';

      let updated = await db.query(Actor).save(created);

      updated.id.should.equal(4);
      updated.name.should.equal('Barry Boldman');
    });
  });

  describe('#create', () => {
    it('should create instances correctly', async () => {
      let actor = new Actor();

      actor.name = 'Gary Oldman';
      actor.age = 58;

      return db.query(Actor)
        .create(actor)
        .then(created => {
          created.name.should.equal('Gary Oldman');
        });
    });

    it('should create instances with manual associations correctly', async () => {
      let bruce = await db.query(Actor).where(m => m.name.eq('Bruce Willis')).findOne();
      let actor = new Actor();

      actor.name = 'Gary Oldman';
      actor.age = 58;

      // Setting with an ID only should work.
      actor.mentor = { id: bruce.id } as Actor;

      return db.query(Actor)
        .include(Actor, m => m.mentor)
        .create(actor)
        .then(created => {
          created.name.should.equal('Gary Oldman');
          created.mentor.name.should.equal('Bruce Willis');
        });
    });

    it('should create instances with not null foreign key', async () => {
      let list = new List({ id: 1, name: 'Test List' });
      await db.query(List).create(list);

      let item = new ListItem({ value: 'testing' });
      item.parent = { id: 1 } as List;

      return db.query(ListItem)
        .include(List, item => item.parent)
        .create(item)
        .then(created => {
          created.value.should.equal(item.value);
          created.parent.name.should.equal(list.name);
        });
    });
  });

  describe('#update', () => {
    it('should update instances correctly', async () => {
      let actor = new Actor();

      actor.age = 62;

      return db.query(Actor)
        .where(m => m.name.eq('Bruce Willis'))
        .update(actor)
        .then((result) => {
          result[0].should.equal(1);
        });
    });

    it('should update with not null primary key', async () => {
      let parent = await db.query(List).create(new List({ name: 'Test List' }));
      let item = new ListItem({ value: 'test value' });
      item.parent = parent;

      let created = await db.query(ListItem).include(List, m => m.parent).create(item);

      created.value = 'updated';

      let updated = await db.query(ListItem).save(created);

      updated.id.should.equal(created.id);
      updated.value.should.equal('updated');
    });
  });

  describe('#findOrCreate', () => {
    it('should find existing records', async () => {
      return db.query(Actor)
        .where(m => m.name.eq('Bruce Willis').and(m.age.eq(61)))
        .findOrCreate()
        .then((result) => {
          result[0].age.should.equal(61);
          result[1].should.equal(false);
        });
    });

    it('should create non-existing records', async () => {
      return db.query(Actor)
        .where(m => m.name.eq('Gary Oldman').and(m.age.eq(58)))
        .findOrCreate()
        .then((result) => {
          result[0].age.should.equal(58);
          result[1].should.equal(true);
        });
    });
  });

  describe('#findById', () => {
    it('should find existing records by ID', async () => {
      let [actor] = await db.query(Actor)
        .where(m => m.name.eq('Gary Oldman').and(m.age.eq(58)))
        .findOrCreate();

      return db.query(Actor)
        .findById(actor.id)
        .then(result => {
          result.name.should.equal('Gary Oldman');
          result.age.should.equal(58);
        });
    });
  });

  describe('#include', () => {
    it('should include associated models', async () => {
      return db.query(Actor)
        .where(m => m.name.eq('Bruce Willis'))
        .include(Actor, m => m.mentor)
        .findOne()
        .then((result) => {
          result.age.should.equal(61);
          result.mentor.name.should.equal('Milla Jojovich');
        });
    });

    it('should include lazy-loaded associated models', async () => {
      return db.query(Actor)
        .where(m => m.name.eq('Chris Tucker'))
        .include(Actor, m => m.mentee)
        .findOne()
        .then((result) => {
          result.mentee.name.should.equal('Milla Jojovich');
        });
    });
  });
});
