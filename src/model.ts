/** Contains the model classes and decorators. */
import * as _ from 'lodash';
import 'reflect-metadata';
import { DataTypeAbstract as DataType, DataTypes,
         DefineOptions, DefineAttributeColumnOptions,
         AssociationOptionsBelongsTo, AssociationOptionsBelongsToMany,
         AssociationOptionsHasMany, AssociationOptionsHasOne
       } from 'sequelize';

import { Attribute } from './attribute';

export { DataTypeAbstract as DataType,
         ABSTRACT, STRING, CHAR, TEXT, NUMBER,
         INTEGER, BIGINT, FLOAT, TIME, DATE,
         DATEONLY, BOOLEAN, NOW, BLOB, DECIMAL,
         NUMERIC, UUID, UUIDV1, UUIDV4, HSTORE,
         JSON, JSONB, VIRTUAL, ARRAY, NONE,
         ENUM, RANGE, REAL, DOUBLE, GEOMETRY,
       } from 'sequelize';

export enum Associations {
  HAS_ONE,
  HAS_MANY,
  BELONGS_TO,
  BELONGS_TO_MANY
};

// Promote association types to top level so they are usable as squell.HAS_ONE, like normal attr types.
export const HAS_ONE = Associations.HAS_ONE;
export const HAS_MANY = Associations.HAS_MANY;
export const BELONGS_TO = Associations.BELONGS_TO;
export const BELONGS_TO_MANY = Associations.BELONGS_TO_MANY;

/**
 * The abstract model class.
 * This should be extended by all database models.
 * Models are designed to be database generic,
 * which means you could have multiple database connections
 * and the model could be defined and queried on them separately.
 */
export abstract class Model {
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

/** The meta key for a model's options on a model class. */
export const MODEL_OPTIONS_META_KEY = 'modelOptions';

/** The meta key for a model attribute key list on a model class. */
export const MODEL_ATTR_KEYS_META_KEY = 'modelAttrKeys';

/** The meta key for an attribute's options, on a specific property. */
export const ATTR_OPTIONS_META_KEY = 'attrOptions';

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
 * A decorator for model attributes to specify attr type and attr properties.
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
export function assoc(type: Associations, model: typeof Model,
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
