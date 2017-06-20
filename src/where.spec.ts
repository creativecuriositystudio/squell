/* tslint:disable:no-magic-numbers */
import 'should';

import { attribute } from './queryable';

describe('Where', () => {
  let attr = attribute('name');
  let ageAttr = attribute('age');

  describe('#and', () => {
    it('should compile', () => {
      ageAttr.eq(40).and(attr.like('%Bruce%')).compile().should.deepEqual({
        age: 40,
        name: { $like: '%Bruce%' }
      });

      ageAttr.eq(40).and(attr.like('%Bruce%').or(attr.like('%Willis%'))).compile().should.deepEqual({
        age: 40,
        $or: [
          {
            name: { $like: '%Bruce%' }
          },

          {
            name: { $like: '%Willis%' }
          }
        ]
      });
    });
  });

  describe('#or', () => {
    it('should compile', () => {
      ageAttr.eq(40).or(attr.like('%Bruce%')).compile().should.deepEqual({
        $or: [
          {
            age: 40
          },

          {
            name: { $like: '%Bruce%' }
          }
        ]
      });
    });
  });
});
