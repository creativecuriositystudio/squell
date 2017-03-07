/* tslint:disable:no-magic-numbers */
import sequelize from 'sequelize';
import 'should';

import { PlainAttribute, ConstantAttribute, FunctionAttribute,
         AliasAttribute, ColumnAttribute, constant, fn, col,
       } from './attribute';

describe('Attribute', () => {
  let attr = new PlainAttribute('name');
  let networthAttr = new PlainAttribute('networth');
  let ageAttr = new PlainAttribute('age');

  describe('#eq', () => {
    it('should compile', () => {
      attr.eq('Bruce Willis').compile().should.deepEqual({
        name: 'Bruce Willis'
      });

      attr.eq(ageAttr).compile().should.deepEqual({
        name: sequelize.col('age')
      });
    });
  });

  describe('#ne', () => {
    it('should compile', () => {
      attr.ne('Bruce Willis').compile().should.deepEqual({
        name: { $ne: 'Bruce Willis' }
      });

      attr.ne(ageAttr).compile().should.deepEqual({
        name: { $ne: sequelize.col('age') }
      });
    });
  });

  describe('#gt', () => {
    it('should compile', () => {
      networthAttr.gt(123).compile().should.deepEqual({
        networth: { $gt: 123 }
      });

      networthAttr.gt(ageAttr).compile().should.deepEqual({
        networth: { $gt: sequelize.col('age') }
      });
    });
  });

  describe('#gte', () => {
    it('should compile', () => {
      networthAttr.gte(123).compile().should.deepEqual({
        networth: { $gte: 123 }
      });

      networthAttr.gte(ageAttr).compile().should.deepEqual({
        networth: { $gte: sequelize.col('age') }
      });
    });
  });

  describe('#lt', () => {
    it('should compile', () => {
      networthAttr.lt(123).compile().should.deepEqual({
        networth: { $lt: 123 }
      });

      networthAttr.lt(ageAttr).compile().should.deepEqual({
        networth: { $lt: sequelize.col('age') }
      });
    });
  });

  describe('#lte', () => {
    it('should compile', () => {
      networthAttr.lte(123).compile().should.deepEqual({
        networth: { $lte: 123 }
      });

      networthAttr.lte(ageAttr).compile().should.deepEqual({
        networth: { $lte: sequelize.col('age') }
      });
    });
  });

  describe('#like', () => {
    it('should compile', () => {
      attr.like('%Bruce%').compile().should.deepEqual({
        name: { $like: '%Bruce%' }
      });

      attr.like(ageAttr).compile().should.deepEqual({
        name: { $like: sequelize.col('age') }
      });
    });
  });

  describe('#notLike', () => {
    it('should compile', () => {
      attr.notLike('%Bruce%').compile().should.deepEqual({
        name: { $notLike: '%Bruce%' }
      });

      attr.notLike(ageAttr).compile().should.deepEqual({
        name: { $notLike: sequelize.col('age') }
      });
    });
  });

  describe('#iLike', () => {
    it('should compile', () => {
      attr.iLike('%Bruce%').compile().should.deepEqual({
        name: { $iLike: '%Bruce%' }
      });

      attr.iLike(ageAttr).compile().should.deepEqual({
        name: { $iLike: sequelize.col('age') }
      });
    });
  });

  describe('#notILike', () => {
    it('should compile correctly', () => {
      attr.notILike('%Bruce%').compile().should.deepEqual({
        name: { $notILike: '%Bruce%' }
      });

      attr.notILike(ageAttr).compile().should.deepEqual({
        name: { $notILike: sequelize.col('age') }
      });
    });
  });

  describe('#not', () => {
    it('should compile', () => {
      attr.not(false).compile().should.deepEqual({
        name: { $not: false }
      });

      attr.not(ageAttr).compile().should.deepEqual({
        name: { $not: sequelize.col('age') }
      });
    });
  });

  describe('#in', () => {
    it('should compile', () => {
      ageAttr.in([1, 2, 3]).compile().should.deepEqual({
        age: { $in: [1, 2, 3] }
      });
    });
  });

  describe('#notIn', () => {
    it('should compile', () => {
      ageAttr.notIn([1, 2, 3]).compile().should.deepEqual({
        age: { $notIn: [1, 2, 3] }
      });
    });
  });

  describe('#between', () => {
    it('should compile', () => {
      ageAttr.between([1, 70]).compile().should.deepEqual({
        age: { $between: [1, 70] }
      });
    });
  });

  describe('#notBetween', () => {
    it('should compile', () => {
      ageAttr.notBetween([1, 70]).compile().should.deepEqual({
        age: { $notBetween: [1, 70] }
      });
    });
  });

  describe('#overlap', () => {
    it('should compile', () => {
      ageAttr.overlap([1, 70]).compile().should.deepEqual({
        age: { $overlap: [1, 70] }
      });
    });
  });

  describe('#contains', () => {
    it('should compile', () => {
      ageAttr.contains([1, 70]).compile().should.deepEqual({
        age: { $contains: [1, 70] }
      });

      ageAttr.contains(1).compile().should.deepEqual({
        age: { $contains: 1 }
      });
    });
  });

  describe('#contained', () => {
    it('should compile', () => {
      ageAttr.contained([1, 70]).compile().should.deepEqual({
        age: { $contained: [1, 70] }
      });
    });
  });

  describe('#any', () => {
    it('should compile', () => {
      ageAttr.any([1, 70]).compile().should.deepEqual({
        age: { $any: [1, 70] }
      });
    });
  });

  describe('#adjacent', () => {
    it('should compile', () => {
      ageAttr.adjacent([1, 70]).compile().should.deepEqual({
        age: { $adjacent: [1, 70] }
      });
    });
  });

  describe('#strictLeft', () => {
    it('should compile', () => {
      ageAttr.strictLeft([1, 70]).compile().should.deepEqual({
        age: { $strictLeft: [1, 70] }
      });
    });
  });

  describe('#strictRight', () => {
    it('should compile', () => {
      ageAttr.strictRight([1, 70]).compile().should.deepEqual({
        age: { $strictRight: [1, 70] }
      });
    });
  });

  describe('#noExtendRight', () => {
    it('should compile', () => {
      ageAttr.noExtendRight([1, 70]).compile().should.deepEqual({
        age: { $noExtendRight: [1, 70] }
      });
    });
  });

  describe('#noExtendLeft', () => {
    it('should compile', () => {
      ageAttr.noExtendLeft([1, 70]).compile().should.deepEqual({
        age: { $noExtendLeft: [1, 70] }
      });
    });
  });
});

describe('PlainAttribute', () => {
  let attr = new PlainAttribute('name');

  describe('#compileLeft', () => {
    it('should compile', () => {
      attr.compileLeft().should.equal('name');
    });
  });

  describe('#compileRight', () => {
    it('should compile', () => {
      attr.compileRight().should.deepEqual(sequelize.col('name'));
    });
  });
});

describe('ConstantAttribute', () => {
  let attr = constant(1234);

  describe('#compileLeft', () => {
    it('should compile', () => {
      attr.compileLeft().should.equal(1234);
    });
  });

  describe('#compileRight', () => {
    it('should compile', () => {
      attr.compileRight().should.equal(1234);
    });
  });
});

describe('ColumnAttribute', () => {
  let attr = col('name');

  describe('#compileLeft', () => {
    it('should not compile', () => {
      attr.compileLeft.should.throw();
    });
  });

  describe('#compileRight', () => {
    it('should compile', () => {
      attr.compileRight().should.deepEqual(sequelize.col('name'));
    });
  });
});

describe('FunctionAttribute', () => {
  let attr = fn('COUNT', constant('name'));

  describe('#compileLeft', () => {
    it('should not compile', () => {
      attr.compileLeft.should.throw();
    });
  });

  describe('#compileRight', () => {
    it('should compile', () => {
      attr.compileRight().should.deepEqual(sequelize.fn('COUNT', 'name'));
    });
  });
});

describe('AliasAttribute', () => {
  let attr = new PlainAttribute('name').as('renamed');

  describe('#compileLeft', () => {
    it('should not compile', () => {
      attr.compileLeft.should.throw();
    });
  });

  describe('#compileRight', () => {
    it('should compile', () => {
      attr.compileRight().should.deepEqual([sequelize.col('name'), 'renamed']);
    });
  });
});
