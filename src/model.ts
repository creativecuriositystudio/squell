/** Contains the model classes and decorators. */
import * as _ from 'lodash';
import 'reflect-metadata';
import { DataTypeAbstract as DataType, DataTypes,
         DefineOptions, DefineAttributeColumnOptions,
         AssociationOptionsBelongsTo, AssociationOptionsBelongsToMany,
         AssociationOptionsHasMany, AssociationOptionsHasOne,
         ValidationError as SequelizeValidationError
       } from 'sequelize';

import { Attribute } from './attribute';
import { Database } from './database';
import { Query } from './query';

export { DataTypeAbstract as DataType,
         ABSTRACT, STRING, CHAR, TEXT, NUMBER,
         INTEGER, BIGINT, FLOAT, TIME, DATE,
         DATEONLY, BOOLEAN, NOW, BLOB, DECIMAL,
         NUMERIC, UUID, UUIDV1, UUIDV4, HSTORE,
         JSON, JSONB, VIRTUAL, ARRAY, NONE,
         ENUM, RANGE, REAL, DOUBLE, GEOMETRY,
       } from 'sequelize';

/** A type of association between models. */
export enum Association {
  HAS_ONE,
  HAS_MANY,
  BELONGS_TO,
  BELONGS_TO_MANY
};

// Promote association types to top level so they are usable as squell.HAS_ONE, like normal attr types.
export const HAS_ONE = Association.HAS_ONE;
export const HAS_MANY = Association.HAS_MANY;
export const BELONGS_TO = Association.BELONGS_TO;
export const BELONGS_TO_MANY = Association.BELONGS_TO_MANY;

/* A type of validation on a model. */
export enum Validation {
  IS,
  NOT,
  IS_EMAIL,
  IS_URL,
  IS_IP,
  IS_IPV4,
  IS_IPV6,
  IS_ALPHA,
  IS_ALPHANUMERIC,
  IS_NUMERIC,
  IS_INT,
  IS_FLOAT,
  IS_DECIMAL,
  IS_LOWERCASE,
  IS_UPPERCASE,
  NOT_EMPTY,
  EQUALS,
  CONTAINS,
  NOT_IN,
  IS_IN,
  NOT_CONTAINS,
  LEN,
  IS_UUID,
  IS_DATE,
  IS_AFTER,
  IS_BEFORE,
  MAX,
  MIN,
  IS_ARRAY,
  IS_CREDIT_CARD
}

// Promote the validation types too.
export const IS = Validation.IS;
export const NOT = Validation.NOT;
export const IS_EMAIL = Validation.IS_EMAIL;
export const IS_URL = Validation.IS_URL;
export const IS_IP = Validation.IS_IP;
export const IS_IPV4 = Validation.IS_IPV4;
export const IS_IPV6 = Validation.IS_IPV6;
export const IS_ALPHA = Validation.IS_ALPHA;
export const IS_ALPHANUMERIC = Validation.IS_ALPHANUMERIC;
export const IS_NUMERIC = Validation.IS_NUMERIC;
export const IS_INT = Validation.IS_INT;
export const IS_FLOAT = Validation.IS_FLOAT;
export const IS_DECIMAL = Validation.IS_DECIMAL;
export const IS_LOWERCASE = Validation.IS_LOWERCASE;
export const IS_UPPERCASE = Validation.IS_UPPERCASE;
export const NOT_EMPTY = Validation.NOT_EMPTY;
export const EQUALS = Validation.EQUALS;
export const CONTAINS = Validation.CONTAINS;
export const NOT_IN = Validation.NOT_IN;
export const IS_IN = Validation.IS_IN;
export const NOT_CONTAINS = Validation.NOT_CONTAINS;
export const LEN = Validation.LEN;
export const IS_UUID = Validation.IS_UUID;
export const IS_DATE = Validation.IS_DATE;
export const IS_AFTER = Validation.IS_AFTER;
export const IS_BEFORE = Validation.IS_BEFORE;
export const MAX = Validation.MAX;
export const MIN = Validation.MIN;
export const IS_ARRAY = Validation.IS_ARRAY;
export const IS_CREDIT_CARD = Validation.IS_CREDIT_CARD;

/**
 * A custom validation function that can be used to validate
 * an attribute.
 */
export interface ValidationFunction {
  /** Validate a value for an attribute. */
  (value: any): boolean;
}

/**
 * The abstract model class.
 * This should be extended by all database models.
 * Models are designed to be database generic,
 * which means you could have multiple database connections
 * and the model could be defined and queried on them separately.
 */
export abstract class Model {
  /**
   * Saves any changes to the model instance and returns the updated instance.
   * If the model didn't already exist in the database (i.e. its primary key
   * wasn't set) then it will create, otherwise update.
   */
  async save<T extends Model>(db: Database, subquery?: (query: Query<T>) => Query<T>): Promise<T> {
    // FIXME: This is hacky, but seems to be the only way to cast to T (even though it extends model..)
    let model = (this as any) as T;

    let constructor = this.constructor as ModelConstructor<T>;
    let primary = db.getModelPrimary(constructor);
    let primaryValue = (this as {})[primary.compileLeft()];
    let query = db.query(constructor);

    if (subquery) {
      query = subquery(query);
    }

    if (primaryValue) {
      query = query.where(m => primary.eq(primaryValue));

      return model;
    }

    return query.create(model);
  }
}

/**
 * Our version of the Sequelize validation error.
 * This has a mapped type, so all the properties on the model
 * are guaranteed to have an array of errors.
 */
export class ValidationError<T extends Model> extends Error {
  ctor: ModelConstructor<T>;
  errors: ModelErrors<T>;

  /**
   * Construct a validation error.
   *
   * @param ctor The model constructor this error is for.
   * @param message The error message.
   * @param err The model errors with all of the validation errors on it.
   */
  constructor(ctor: ModelConstructor<T>, message: string, errors: ModelErrors<T>) {
    super(message);

    this.name = 'ValidationError';
    this.stack = new Error().stack;
    this.ctor = ctor;
    this.errors = errors;
  }

  /**
   * Coerce a Sequelize validation error into our type-safe form.
   *
   * @param ctor The model constructor.
   * @param err The Sequelize validation error.
   * @returns The coerced Squell validation error.
   */
  static coerce<T extends Model>(ctor: ModelConstructor<T>, err: SequelizeValidationError): ValidationError<T> {
    let errors = {};
    let attrKeys: string[] = Reflect.getMetadata(MODEL_ATTR_KEYS_META_KEY, ctor.prototype) || [];
    let assocKeys: string[] = Reflect.getMetadata(MODEL_ASSOC_KEYS_META_KEY, ctor.prototype) || [];

    // Get all the errors for the specific attribute.
    for (let key of attrKeys) {
      errors[key] = _.map(err.get(key), item => {
        return _.pick(item, ['message', 'value']);
      });
    }

    // Just set empty. We don't validate associations (yet).
    for (let key of assocKeys) {
      errors[key] = [];
    }

    let coercedErr = new ValidationError<T>(ctor, err.message, errors as ModelErrors<T>);

    coercedErr.stack = err.stack;

    return coercedErr;
  }
}

/** A value that is both a class value and something that can construct a model. */
export type ModelConstructor<T extends Model> = typeof Model & { new(): T };

/**
 * A mapped type that maps all of a model type's
 * attributes to the Squell attribute type
 * to support type-safe queries.
 */
export type ModelAttributes<T extends Model> = {
  [P in keyof T]?: Attribute<T[P]>;
};

/** A error on a specific model attribute. */
export interface AttributeError {
  message: string;
  value: string;
}

/**
 * A mapped type that maps all of a model type's
 * attributes to an array of validation errors.
 */
export type ModelErrors<T extends Model> = {
  [P in keyof T]?: AttributeError[];
};

/** The meta key for a model's options on a model class. */
export const MODEL_OPTIONS_META_KEY = 'modelOptions';

/** The meta key for a model attribute key list on a model class. */
export const MODEL_ATTR_KEYS_META_KEY = 'modelAttrKeys';

/** The meta key for an attribute's options, on a specific property. */
export const ATTR_OPTIONS_META_KEY = 'attrOptions';

/** The meta key for an attribute's validations, on a specific property. */
export const ATTR_VALIDATIONS_META_KEY = 'attrValidations';

/** The meta key for a model association key list on a model class. */
export const MODEL_ASSOC_KEYS_META_KEY = 'modelAssocKeys';

/** The meta key for an attribute's options, on a specific property. */
export const ASSOC_OPTIONS_META_KEY = 'assocOptions';

/**
 * A decorater for model classes.
 * This must be used on every model class that is to be used with a Squell query,
 * as each Squell model must have its name defined.
 * Sequelize model options can also be provided.
 *
 * @param modelName The name of the model class. This will be used to generate the table name,
 *                  unless a table name is provided.
 * @param options   Any extra Sequelize model options required.
 */
export function model(modelName: string, options?: Partial<DefineOptions<any>>) {
  return Reflect.metadata(MODEL_OPTIONS_META_KEY, _.extend({}, options, { modelName }));
}

/**
 * A decorator for model attributes to specify attribute type and properties.
 * This must be used on any model attribute that should be synchronised to the database.
 * These attributes can then be used in type-safe Squell queries.
 * Any attributes that do not use this decorator during definition will not be able
 * to be queried using Squell.
 *
 * @param type    The Sequelize data type for the attribute.
 * @param options Any extra Sequelize attribute options required.
 */
export function attr(type: DataType, options?: Partial<DefineAttributeColumnOptions>) {
  return (target: Object, key: string | symbol) => {
    // We have to build up an array of attribute keys as there's no nice way to do
    // this in a type-safe manner.
    // Default to an empty array in the case this is the first attribute being defined.
    let keys: string[] = Reflect.getMetadata(MODEL_ATTR_KEYS_META_KEY, target) || [];

    keys.push(key.toString());

    // Define the attribute options by the property/attribute key and then redefine the key list.
    Reflect.defineMetadata(ATTR_OPTIONS_META_KEY, { ... options, type }, target, key);
    Reflect.defineMetadata(MODEL_ATTR_KEYS_META_KEY, keys, target);
  };
}

/**
 * A decorator for model attributes to specify validations for an attribute.
 * A message and arguments can be provided which will be passed to the equivalent
 * Sequelize validator. For more detail on the arguments that can be provided,
 * check the Sequelize validation definition docs.
 *
 * @see http://docs.sequelizejs.com/en/v3/docs/models-definition/#validations
 * @param validation
 * @param options Any extra Sequelize attribute options required.
 */
export function validate(validation: Validation | ValidationFunction, options?: { msg?: string, args?: any }) {
  return (target: Object, key: string | symbol) => {
    let validations: {} = Reflect.getMetadata(ATTR_VALIDATIONS_META_KEY, target, key) || {};
    let keys = Object.keys(validations);

    if (typeof (validation) === 'function') {
      // Generate a unique-ish key for the custom validation.
      // We make our own function here that checks the provided
      // function and throws with a specific error message if it fails.
      validations['custom' + keys.length] = (value: any) => {
        if (!validation(value)) {
          throw new Error((options ? options.msg : null) || 'Custom validation failed');
        }
      };
    } else {
      let validator;

      switch (validation) {
        case IS: validator = 'is'; break;
        case NOT: validator = 'not'; break;
        case IS_EMAIL: validator = 'isEmail'; break;
        case IS_URL: validator = 'isUrl'; break;
        case IS_IP: validator = 'isIP'; break;
        case IS_IPV4: validator = 'isIPv4'; break;
        case IS_IPV6: validator = 'isIPv6'; break;
        case IS_ALPHA: validator = 'isAlpha'; break;
        case IS_ALPHANUMERIC: validator = 'isAlphanumeric'; break;
        case IS_NUMERIC: validator = 'isNumeric'; break;
        case IS_INT: validator = 'isInt'; break;
        case IS_FLOAT: validator = 'isFloat'; break;
        case IS_DECIMAL: validator = 'isDecimal'; break;
        case IS_LOWERCASE: validator = 'isLowercase'; break;
        case IS_UPPERCASE: validator = 'isUppercase'; break;
        case NOT_EMPTY: validator = 'notEmpty'; break;
        case EQUALS: validator = 'equals'; break;
        case CONTAINS: validator = 'contains'; break;
        case NOT_IN: validator = 'notIn'; break;
        case IS_IN: validator = 'isIn'; break;
        case NOT_CONTAINS: validator = 'notContains'; break;
        case LEN: validator = 'len'; break;
        case IS_UUID: validator = 'isUUID'; break;
        case IS_DATE: validator = 'isDate'; break;
        case IS_AFTER: validator = 'isAfter'; break;
        case IS_BEFORE: validator = 'isBefore'; break;
        case MAX: validator = 'max'; break;
        case MIN: validator = 'min'; break;
        case IS_ARRAY: validator = 'isArray'; break;
        case IS_CREDIT_CARD: validator = 'isCreditCard'; break;
      }

      if (!validator) {
        return;
      }

      validations[validator] = options || true;
    }

    // Redefine the validations with the new one added.
    Reflect.defineMetadata(ATTR_VALIDATIONS_META_KEY, validations, target, key);
  };
}

/**
 * A decorator for model attributes to signify a association to another model.
 * This must be used on any model association that should be synchronised to the database.
 * These associations can then be used in type-safe Squell queries as if they were a regular attribute.
 * Any associations that do not use this decorator during definition will not be able
 * to be queried using Squell.
 *
 * Note that Squell enforces the behaviour of the as property of the association (the alias)
 * always being the same as the name of the property the association was defined on.
 * This can't be changed.
 *
 * @param type    The Sequelize data type for the attribute.
 * @param options Any extra Sequelize attribute options required.
 */
export function assoc(type: Association, model: typeof Model,
                      options?: Partial<AssociationOptionsHasOne    |
                                        AssociationOptionsBelongsTo |
                                        AssociationOptionsHasMany   |
                                        AssociationOptionsBelongsToMany>) {
  return (target: Object, key: string | symbol) => {
    // We have to build up an array of association keys as there's no nice way to do
    // this in a type-safe manner.
    // Default to an empty array in the case this is the first attribute being defined.
    let keys: string[] = Reflect.getMetadata(MODEL_ASSOC_KEYS_META_KEY, target) || [];

    keys.push(key.toString());

    // Define the associations options by the property/attribute key and then redefine the key list.
    options = { ... options, as: key.toString() };

    Reflect.defineMetadata(ASSOC_OPTIONS_META_KEY, { type, model, options }, target, key);
    Reflect.defineMetadata(MODEL_ASSOC_KEYS_META_KEY, keys, target);
  };
}
