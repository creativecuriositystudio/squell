/* tslint:disable:no-magic-numbers */
import 'should';
import * as sequelize from 'sequelize';
import * as modelsafe from 'modelsafe';

import { Database } from './database';
import { attr } from './metadata';
import { ASC, DESC } from './query';

/* tslint:disable:completed-docs */
@modelsafe.model()
class Actor extends modelsafe.Model {
  @attr({ autoIncrement: true })
  @modelsafe.attr(modelsafe.INTEGER, { primary: true })
  id: number;

  @modelsafe.attr(modelsafe.STRING)
  public name: string;

  @modelsafe.attr(modelsafe.INTEGER)
  public age: number;

  @modelsafe.assoc(modelsafe.BELONGS_TO, Actor)
  public mentor: Actor;

  @modelsafe.assoc(modelsafe.HAS_ONE, Actor)
  public mentee: Actor;
}
/* tslint:enable-completed-docs */

let db = new Database('sqlite://root:root@localhost/squell_test', {
  storage: 'test.db',
  logging: !!process.env.LOG_TEST_SQL
});

db.define(Actor);

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

        await db
          .query(Actor)
          .where(m => m.id.eq(bruce.id))
          .include(Actor, m => m.mentor)
          .update(bruce);
      });
  });

  describe('#compileFindOptions', () => {
    it('should compile', () => {
      let options = db.query(Actor)
        .where(m => m.name.eq('Bruce Willis'))
        .attributes(m => [m.name])
        .order(m => [[m.name, DESC]])
        .take(5)
        .drop(5)
        .compileFindOptions();

      options.should.deepEqual({
        where: { name: 'Bruce Willis' },
        order: [[sequelize.col('name'), 'DESC']],
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

    it('should find one 50 yo when dropped', async () => {
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
  });
});
