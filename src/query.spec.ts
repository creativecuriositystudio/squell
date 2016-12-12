import sequelize from 'sequelize';
import 'should';

import { Database } from './database';
import { attr, model } from './model';
import * as squell from './index';

@model('actor')
class Actor extends squell.Model {
  @attr(squell.INTEGER, { primaryKey: true, autoIncrement: true })
  public id: number;

  @attr(squell.STRING)
  public name: string;

  @attr(squell.INTEGER)
  public age: number;
}

let db = new Database('sqlite://root:root@localhost/squell_test', {
  storage: 'test.db',
  logging: false
});

db.define(Actor);

describe('Query', () => {
  beforeEach(() => {
    return db.sync({ force: true })
      .then(() => {
        let bruce = new Actor();
        let milla = new Actor();
        let chris = new Actor();

        bruce.name = 'Bruce Willis';
        bruce.age = 61;

        milla.name = 'Milla Jojovich';
        milla.age = 40;

        chris.name = 'Chris Tucker';
        chris.age = 45;

        return db.query(Actor).bulkCreate([bruce, milla, chris]);
      });
  });

  describe('#compileFindOptions', () => {
    it('should compile', () => {
      let options = db.query(Actor)
        .where(m => m.name.eq('Bruce Willis'))
        .attributes(m => [m.name])
        .order(m => [[m.name, squell.DESC]])
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
    it('should find by name', () => {
      return db.query(Actor)
        .where(m => m.name.eq('Bruce Willis'))
        .findOne()
        .then((actor) => {
          actor.name.should.equal('Bruce Willis');
        });
    });
  });

  describe('#find', () => {
    it('should find less than 50 yos', () => {
      return db.query(Actor)
        .where(m => m.age.lt(50))
        .find()
        .then((actors) => {
          actors.should.have.length(2);
        });
    });

    it('should find one 50 yo when dropped', () => {
      return db.query(Actor)
        .where(m => m.age.lt(50))
        .take(1)
        .find()
        .then((actors) => {
          actors.should.have.length(1);
        });
    });

    it('should find ordered correctly', () => {
      return db.query(Actor)
        .order(m => [[m.age, squell.ASC]])
        .find()
        .then((actors) => {
          actors[0].age.should.equal(40);
          actors[2].age.should.equal(61);
        });
    });
  });

  describe('#count', () => {
    it('should count all actors', () => {
      return db.query(Actor)
        .count()
        .then((num) => {
          num.should.equal(3);
        });
    });

    it('should count two actors under 50 yo', () => {
      return db.query(Actor)
        .where(m => m.age.lt(50))
        .count()
        .then((num) => {
          num.should.equal(2);
        });
     });
  });

  describe('#aggregate', () => {
    it('should average ages correctly', () => {
      return db.query(Actor)
        .aggregate('AVG', m => m.age)
        .then((num) => {
          Math.ceil(num).should.equal(48);
        });
     });
  });

  describe('#min', () => {
    it('should find the minimum age', () => {
      return db.query(Actor)
        .min(m => m.age)
        .then((num) => {
          num.should.equal(40);
        });
     });
  });

  describe('#max', () => {
    it('should find the maximum age', () => {
      return db.query(Actor)
        .max(m => m.age)
        .then((num) => {
          num.should.equal(61);
        });
     });
  });

  describe('#sum', () => {
    it('should find the total age', () => {
      return db.query(Actor)
        .sum(m => m.age)
        .then((num) => {
          num.should.equal(146);
        });
     });
  });

  describe('#truncate', () => {
    it('should clear the database table', () => {
      return db.query(Actor)
        .truncate()
        .then(() => {
          return db.query(Actor)
            .count()
            .then((num) => {
              num.should.equal(0);
            });
        });
     });
  });

  describe('#destroy', () => {
    it('should clear the database table', () => {
      return db.query(Actor)
        .destroy()
        .then(() => {
          return db.query(Actor)
            .count()
            .then((num) => {
              num.should.equal(0);
            });
        });
     });
  });

  describe('#create', () => {
    it('should create instances correctly', () => {
      let actor = new Actor();

      actor.name = 'Gary Oldman';
      actor.age = 58;

      return db.query(Actor)
        .create(actor)
        .then((created) => {
          created.name.should.equal('Gary Oldman');
        });
     });
  });

  describe('#update', () => {
    it('should update instances correctly', () => {
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
    it('should find existing records', () => {
      return db.query(Actor)
        .where(m => m.name.eq('Bruce Willis').and(m.age.eq(61)))
        .findOrCreate()
        .then((result) => {
          result[0].age.should.equal(61);
          result[1].should.equal(false);
        });
    });

    it('should create non-existing records', () => {
      return db.query(Actor)
        .where(m => m.name.eq('Gary Oldman').and(m.age.eq(58)))
        .findOrCreate()
        .then((result) => {
          result[0].age.should.equal(58);
          result[1].should.equal(true);
        });
     });
  });
});
