/** Contains the type-safe querying interface that wraps Sequelize queries. */
import Bluebird from 'bluebird';
import * as _ from 'lodash';
import Sequelize from 'sequelize';
import { FindOptions, WhereOptions, FindOptionsAttributesArray,
         DestroyOptions, TruncateOptions, RestoreOptions,
         CountOptions, AggregateOptions, CreateOptions, UpdateOptions,
         BulkCreateOptions, UpsertOptions, FindOrInitializeOptions,
       } from 'sequelize';

import { Attribute, PlainAttribute } from './attribute';
import { MODEL_ATTR_KEYS_META_KEY, Model, ModelAttributes } from './model';
import { Where } from './where';

/** A type alias for a sorting order. */
export type Order = string;

/** Represents descending order. */
export const DESC: Order = 'DESC';

/** Represents ascending order. */
export const ASC: Order  = 'ASC';

/** Represents the ordering of an attribute. */
export type AttributeOrder<T> = [Attribute<T>, Order];

/**
 * A type-safe query on a Squell model.
 * This is the main interaction with the library, and every Squell query compiles
 * down to a relevant Sequelize query.
 */
export class Query<T extends Model> {
  /** The Squell model being queried. */
  private model: typeof Model;

  /** The internal Sequelize representation of the model. */
  private internalModel: Sequelize.Model<T, T>;

  /** The array of where queries for the query. */
  private wheres: Where[];

  /** The array of attribute filters for the query. */
  private attrs: Attribute<any>[];

  /** The array of attribute orderings for the query. */
  private orderings: AttributeOrder<any>[];

  /** The number of records to drop (i.e. OFFSET). */
  private dropped: number;

  /** The number of records to take (i.e. LIMIT). */
  private taken: number;

  /**
   * Construct a query. This generally should not be done by user code,
   * rather the query function on a database connection should be used.
   *
   * @param model The model class.
   * @param internalModel The internal Sequelize representation of the model.
   * @param wheres The array of where queries.
   * @param attrs The array of attribute filters.
   * @param orderings The array of attribute orderings.
   * @param dropped The number of records to be dropped.
   * @param taken The number of records to be taken.
   */
  constructor(model: typeof Model, internalModel: Sequelize.Model<T, T>,
              wheres?: Where[], attrs?: Attribute<any>[],
              orderings?: AttributeOrder<any>[], dropped?: number,
              taken?: number) {
    this.model = model;
    this.internalModel = internalModel;
    this.wheres = wheres || [];
    this.attrs = attrs;
    this.orderings = orderings;
    this.dropped = 0;
    this.taken = 0;
  }

  /**
   * Filter a query using a where query.
   *
   * @param map A lambda function that will take the queried model attributes
   *            and produce the where query to filter using.
   * @returns   The filtered query.
   */
  public where(map: (attrs: ModelAttributes<T>) => Where): Query<T> {
    return new Query<T>(this.model, this.internalModel,
                        this.wheres.concat(map(this.getModelAttrs())),
                        this.attrs, this.orderings, this.dropped,
                        this.taken);
  }

  /**
   * Select the attributes to be included in a query result.
   *
   * @params map A lambda function that will take the queried model attributes
   *             and produce an array of attributes to be included.
   * @returns The new query with the selected attributes only.
   */
  public attributes(map: (attrs: ModelAttributes<T>) => Attribute<any>[]): Query<T> {
    let attrs = this.attrs || [];

    return new Query<T>(this.model, this.internalModel, this.wheres,
                        attrs.concat(map(this.getModelAttrs())),
                        this.orderings, this.dropped, this.taken);
  }

  /**
   * Order the future results of a query.
   *
   * @params map A lambda function that will take the queried model attributes
   *             and produce an array of attribute orders for the result to be ordered by.
   * @returns    The ordered query.
   */
  public order(map: (attrs: ModelAttributes<T>) => AttributeOrder<any>[]): Query<T> {
    let orderings = this.orderings || [];

    return new Query<T>(this.model, this.internalModel, this.wheres, this.attrs,
                        orderings.concat(map(this.getModelAttrs())),
                        this.dropped, this.taken);
  }

  /**
   * Drop a number of future results from the query.
   * This essentially increases the OFFSET amount,
   * and will only affect the find and findOne queries.
   */
  public drop(num: number) {
    return new Query<T>(this.model, this.internalModel, this.wheres,
                        this.attrs, this.orderings,
                        this.dropped + num, this.taken);
  }

  /**
   * Take a number of future results from the query.
   * This increases the LIMIT amount and will affect find,
   * findOne, restore, destroy, aggregation and updates.
   */
  public take(num: number) {
    return new Query<T>(this.model, this.internalModel, this.wheres,
                        this.attrs, this.orderings,
                        this.dropped, this.taken + num);
  }

  /**
   * Find a list of model instances using the built query.
   *
   * @param options Any extra Sequelize find options required.
   * @returns A promise that resolves to a list of found instances if successful.
   */
  public find(options?: FindOptions): Bluebird<T[]> {
    return this.internalModel.findAll(_.extend({}, options, this.compileFindOptions()));
  }

  /**
   * Find a single model instance using the built query.
   *
   * @param options Any extra Sequelize find options required.
   * @returns A promise that resolves to the found instance if successful.
   */
  public findOne(options?: FindOptions): Bluebird<T> {
    return this.internalModel.findOne(_.extend({}, options, this.compileFindOptions()));
  }

  /**
   * Truncate the model table in the database.
   *
   * @returns A promise that resolves when the model table has been truncated.
   */
  public truncate(): Bluebird<void> {
    return this.internalModel.truncate();
  }

  /**
   * Restore deleted model instances to the database using
   * the built query. This will only work on paranoid deletion
   * models.
   *
   * @param options Any extra Sequelize restore options required.
   * @returns A promise that resolves when the instances have been restored successfully.
   */
  public restore(options?: RestoreOptions): Bluebird<void> {
    return this.internalModel.restore(_.extend({}, options, {
      where: this.compileWheres(),
      limit: this.taken,
    }));
  }

  /**
   * Destroys model instances from the database using the
   * built query. This can destroy multiple instances if the query
   * isn't specific enough.
   *
   * @param options Any extra Sequelize destroy options required.
   * @returns A promise that resolves when the instances have been destroyed successfully.
   */
  public destroy(options?: DestroyOptions): Bluebird<number> {
    return this.internalModel.destroy(_.extend({}, options, {
      where: this.compileWheres(),
      limit: this.taken,
    }));
  }

  /**
   * Counts the number of the model instances returned from the database
   * for the built query.
   *
   * @param options Any extra Sequelize count options required.
   * @returns A promise that resolves with the number of records found if successful.
   */
  public count(options?: CountOptions): Bluebird<number> {
    return this.internalModel.count(_.extend({}, options, {
      where: this.compileWheres(),
    }));
  }

  public aggregate(fn: string, map: (attrs: ModelAttributes<T>) => Attribute<any>,
                   options?: AggregateOptions): Bluebird<any> {
    return this.internalModel.aggregate(map(this.getModelAttrs()).compileLeft(), fn, _.extend({}, options, {
      where: this.compileWheres(),
      limit: this.taken,
    }));
  }

  public min(map: (attrs: ModelAttributes<T>) => Attribute<any>,
             options?: AggregateOptions): Bluebird<any> {
    return this.aggregate('min', map, options);
  }

  public max(map: (attrs: ModelAttributes<T>) => Attribute<any>,
             options?: AggregateOptions): Bluebird<any> {
    return this.aggregate('max', map, options);
  }

  public sum(map: (attrs: ModelAttributes<T>) => Attribute<any>,
             options?: AggregateOptions): Bluebird<any> {
    return this.aggregate('sum', map, options);
  }

  public findOrCreate(options?: FindOrInitializeOptions<T>): Bluebird<[T, boolean]> {
    return this.internalModel.findOrCreate(_.extend({}, options, {
      where: this.compileWheres(),
    }));
  }

  /**
   * Creates a model instance in the database.
   *
   * @param model The model instance to create.
   * @param option Any extra Sequelize create options required.
   * @returns A promise that resolves with the created instance if successful.
   */
  public create(model: T, options?: CreateOptions): Bluebird<T> {
    return this.internalModel.create(model, options);
  }

  /**
   * Creates multiple instances in the database.
   * Note, that like Sequelize, there's no guaranteed that
   * the returned values here are the exact values that have been created.
   * If you want those values, you should re-query the database
   * once the bulk create has succeeded.
   *
   * @param models The array of model instances to create.
   * @param options Any extra Sequelize bulk create options required.
   * @returns The array of instances created. See above.
   */
  public bulkCreate(models: T[], options?: BulkCreateOptions): Bluebird<T[]> {
    return this.internalModel.bulkCreate(models, options);
  }

  /**
   * Update an instance in the database using the query.
   * The model provided will be used as a mapped partial version, which
   * means that all of the model properties are optional - and
   * if there's not defined, they won't be updated.
   *
   * This can update multiple instances if the query isn't specific enough.
   *
   * @param model The model partial to update using.
   * @param options Any extra Sequelize update options required.
   * @return A promise that resolves to a tuple with the number of instances updated and
   *         an array of the instances updated, if successful.
   */
  public update(model: Partial<T>, options?: UpdateOptions): Bluebird<[number, T[]]> {
    return this.internalModel.update(model as T, _.extend({}, options, {
      where: this.compileWheres(),
      limit: this.taken,
    }));
  }

  /**
   * Update or insert a model using the provided model as a query.
   * This will update an instance from the provided partial, or insert/create one
   * if none exists matching the provided model instance.
   * The model provided will be used as a partial, which will mean that all
   * attributes are optional and non-defined ones will be excluded from
   * the query/insertion.
   *
   * @param model The model partial to upsert using.
   * @param options Any extra Sequelize upsert options required.
   * @returns A promise that will upsert and contain true if an instance was inserted.
   */
  public upsert(model: Partial<T>, options?: UpsertOptions): Bluebird<boolean> {
    return this.internalModel.upsert(model as T, options);
  }

  /**
   * Gets the model attributes object from the model being queried.
   *
   * @returns The model attributes object.
   */
  protected getModelAttrs(): ModelAttributes<T> {
    let attrs = {};
    let keys: string[] = Reflect.getMetadata(MODEL_ATTR_KEYS_META_KEY, this.model.prototype);

    for (let key of keys) {
      attrs[key] = new PlainAttribute(key);
    }

    return attrs as ModelAttributes<T>;
  }

  /**
   * Compile the find options for a find/findOne call, as expected by Sequelize.
   *
   * @returns The Sequelize representation.
   */
  protected compileFindOptions(): FindOptions {
    let options: FindOptions = {
      where: this.compileWheres(),
    };

    if (this.attrs) {
      options.attributes = this.compileAttributes();
    }

    if (this.orderings) {
      options.order = this.compileOrderings();
    }

    if (this.dropped > 0) {
      options.offset = this.dropped;
    }

    if (this.taken > 0) {
      options.limit = this.taken;
    }

    return options;
  }

  /**
   * Compile the where query to a representation expected by Sequelize.
   *
   * @returns The Sequelize representation.
   */
  protected compileWheres(): WhereOptions {
    return _.extend.apply(_, [{}].concat(this.wheres.map(w => w.compile())));
  }

  /**
   * Compile the attributes to a representation expected by Sequelize.
   *
   * @returns The Sequelize representation.
   */
  protected compileAttributes(): FindOptionsAttributesArray {
    return this.attrs.map(w => w.compileRight());
  }

  /**
   * Compile the orderings to a representation expected by Sequelize.
   *
   * @returns The Sequelize representation.
   */
  protected compileOrderings(): any {
    return this.orderings.map(o => [o[0].compileRight(), o[1].toString()]);
  }

}
