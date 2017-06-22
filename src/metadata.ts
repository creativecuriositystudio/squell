/* tslint:disable:ban-types */
import 'reflect-metadata';
import { Model, ModelConstructor } from 'modelsafe';
import { DefineAttributeColumnOptions, DefineOptions, AssociationOptionsBelongsTo,
         AssociationOptionsHasOne, AssociationOptionsHasMany, AssociationOptionsManyToMany,
         Model as SequelizeModel, ThroughOptions, AssociationForeignKeyOptions } from 'sequelize';

/** The meta key for a model's options on a model class. */
export const MODEL_OPTIONS_META_KEY = 'squell:options';

/** The meta key for attribute options on a model class. */
export const MODEL_ATTR_OPTIONS_META_KEY = 'squell:attrOptions';

/** The meta key for association options on a model class. */
export const MODEL_ASSOC_OPTIONS_META_KEY = 'squell:assocOptions';

/**
 * Association options for a belongs to many. This is the same
 * as the Sequelize options with the added ability to
 * specify a ModelSafe model to use as the join/through.
 *
 * @see Sequelize
 */
export interface AssociationOptionsBelongsToMany extends AssociationOptionsManyToMany {
  /**
   * The target to use as a through/join table.
   *
   * If it's a ModelSafe model, then it must be defined on the Squell database.
   * The other options are based off Sequelize's belongs to many options.
   *
   * @see Sequelize
   */
  through: ModelConstructor<any> | SequelizeModel<any, any> | string | ThroughOptions;

  /**
   * The name of the foreign key in the join table (representing the target model).
   * This is the same as the Sequelize definition of this option.
   *
   * @see Sequelize
   */
  otherKey?: string | AssociationForeignKeyOptions;
}

/**
 * Define any extra Sequelize model options on a model constructor.
 *
 * @param ctor The model constructor.
 * @param options The model options.
 */
export function defineModelOptions<T extends Model>(ctor: Function, options: Partial<DefineOptions<T>>) {
  // We extend the existing options so that other options defined on the prototype get inherited.
  options = {
    ... Reflect.getMetadata(MODEL_OPTIONS_META_KEY, ctor.prototype),

    ... options
  };

  Reflect.defineMetadata(MODEL_OPTIONS_META_KEY, options, ctor.prototype);
}

/**
 * Define any extra Sequelize association options on the model constructor.
 *
 * @param ctor The model constructor.
 * @param key The association's property key.
 * @param options The association options.
 */
export function defineAssociationOptions(
  ctor: object,
  key: string | symbol,
  options: Partial<AssociationOptionsBelongsTo    |
                   AssociationOptionsHasOne       |
                   AssociationOptionsHasMany      |
                   AssociationOptionsBelongsToMany>
) {
  options = {
    ... Reflect.getMetadata(MODEL_ASSOC_OPTIONS_META_KEY, ctor, key),
    ... options
  };

  Reflect.defineMetadata(MODEL_ASSOC_OPTIONS_META_KEY, options, ctor, key);
}

/**
 * Define any extra Sequelize attribute options on the model constructor.
 *
 * @param ctor The model constructor.
 * @param key The attribute's property key.
 * @param options The attribute options.
 */
export function defineAttributeOptions(ctor: object, key: string | symbol, options: Partial<DefineAttributeColumnOptions>) {
  options = {
    ... Reflect.getMetadata(MODEL_ATTR_OPTIONS_META_KEY, ctor, key),
    ... options
  };

  Reflect.defineMetadata(MODEL_ATTR_OPTIONS_META_KEY, options, ctor, key);
}

/**
 * Get the model options for a model constructor.
 *
 * @param ctor The model constructor.
 * @returns The model options.
 */
export function getModelOptions<T extends Model>(ctor: Function): DefineOptions<T> {
  return { ... Reflect.getMetadata(MODEL_OPTIONS_META_KEY, ctor.prototype) };
}

/**
 * Get the association options for an association on a model constructor.
 *
 * @param ctor The model constructor.
 * @param key The association key.
 * @returns The model associations.
 */
export function getAssociationOptions(ctor: Function, key: string | symbol): AssociationOptionsBelongsTo     |
                                                                             AssociationOptionsHasOne        |
                                                                             AssociationOptionsHasMany       |
                                                                             AssociationOptionsBelongsToMany {
  return { ... Reflect.getMetadata(MODEL_ASSOC_OPTIONS_META_KEY, ctor.prototype, key) };
}

/**
 * Get the attribute options for an attribute on a model constructor.
 *
 * @param ctor The model constructor.
 * @param key The attribute key.
 * @returns The model attributes.
 */
export function getAttributeOptions(ctor: Function, key: string | symbol): DefineAttributeColumnOptions {
  return { ... Reflect.getMetadata(MODEL_ATTR_OPTIONS_META_KEY, ctor.prototype, key) };
}

/**
 * A decorator for Sequelize-specific model options.
 * This should be used in conjuction with the relevant @model decorator
 * from ModelSafe, not on its own.
 *
 * @param options The Sequelize model options.
 */
export function model<T extends Model>(options: Partial<DefineOptions<T>>) {
  return (ctor: Function) => defineModelOptions(ctor, options);
}

/**
 * A decorator for Sequelize-specific attribute options.
 * This should be used in conjuction with the relevant @attr decorator
 * from ModelSafe, not on its own.
 *
 * @param options The Sequelize attribute options.
 */
export function attr(options: Partial<DefineAttributeColumnOptions>) {
  return (ctor: object, key: string | symbol) => defineAttributeOptions(ctor, key, options);
}

/**
 * A decorator for Sequelize-specific association options.
 * This should be used in conjuction with the relevant @assoc decorator
 * from ModelSafe, not on its own.
 *
 * @param options The Sequelize association options.
 */
export function assoc(options: Partial<AssociationOptionsBelongsTo    |
                                       AssociationOptionsHasOne       |
                                       AssociationOptionsHasMany      |
                                       AssociationOptionsBelongsToMany>) {
  return (ctor: object, key: string | symbol) => defineAssociationOptions(ctor, key, options);
}
