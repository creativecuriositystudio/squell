# 0.5.1

* Bump to ModelSafe 0.5.2 for `ValidationError` fixes

# 0.5.0

* Add `findById` operation

# 0.4.0

* Support ModelSafe's new lazy loading association declaration feature
* Add `save` operation to querying that either updates or creates a model instance
  automatically based off the primary key of the model

# 0.3.1

* Re-add `getModelPrimary` as `getInternalModePrimary` to the database class

# 0.3.0

* Migrate to using ModelSafe for model definitions
* Simplify existing code / improve code quality
