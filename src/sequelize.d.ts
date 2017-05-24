import { Hooks } from "sequelize";

declare module "sequelize" {
    export interface Model<TInstance, TAttributes> extends Hooks<TInstance>, Associations {
        /**
         * A hashmap of associations defined for this model.
         * @param {string} key - The name of the association
         * @return {Association} The association definition.
         */
        associations: { [key: string]: Association };
    }


    /**
     * Defines an association between models. 
     */
    export interface Association {
        /**
         * The field on the source instance used to access the associated target instance.
         */
        associationAccessor: string;

        /**
         * The type of the association. One of `HasMany`, `BelongsTo`, `HasOne`, `BelongsToMany`
         */
        associationType: string;

        /**
         * The foreign key options specified for this association, if any.
         */
        foreignKey: AssociationForeignKeyOptions;
    }

    /**
     * Defines a BelongsTo association between two models, where the source model as a foreign key to the target.
     */
    export interface BelongsToAssociation extends Association {
        /**
         * The name of the attribute that contains the identifier on the source.
         */
        identifier: string;

        /**
         * The name of the attribute that contains the identifier on the target.
         */
        targetIdentifier: string;
    }
}