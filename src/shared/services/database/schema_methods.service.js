import DBOperation from "./database_operation.service.js";
import { logger, level } from "./../../../config/logger.js";

export function SchemaMethods(model) {
  const originalAggregate = model.aggregate;
  model.add = async function(inputData) {
    try {
      return await DBOperation.create(this, inputData);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

  model.isExist = async function(filter, option) {
    try {
      const doc = await DBOperation.get(this, filter, null, option);
      return doc.length > 0;
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

  model.get = async function(filter, returnField = null, option = null, populate = null) {
    try {
      return await DBOperation.get(this, filter, returnField, option, populate);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

  model.count = async function(filter, option = null) {
    try {
      return await DBOperation.getCount(this, filter, option);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

  model.update = async function(filter, updatedField, populate = null) {
    try {
      return await DBOperation.update(this, filter, updatedField, populate);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

  model.upsert = async function(filter, updatedField, populate = null) {
    try {
      return await DBOperation.upsert(this, filter, updatedField, populate);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

  model.updateMany = async function(filter, updatedField) {
    try {
      return await DBOperation.updateMany(this, filter, updatedField);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

  model.delete = async function(filter) {
    try {
      return await DBOperation.delete(this, filter);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

  model.deleteMany = async function(filter) {
    try {
      return await DBOperation.deleteMany(this, filter);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };

model.runAggregate = async function(pipeline) {
    try {
        logger.log(level.info, `Running aggregate on model: ${this.modelName}`);
        logger.log(level.info, `Pipeline: ${JSON.stringify(pipeline)}`);

        // Call the original Mongoose aggregate method
        const data = await originalAggregate.call(this, pipeline).exec();
        logger.log(level.info, `Aggregation result count: ${data.length}`);
        return data;
    } catch (err) {
        logger.log(level.error, `runAggregate error: ${err.message}`);
        throw err;
    }
};

  model.distinct = async function(field, condition) {
    try {
      return await DBOperation.distinct(this, field, condition);
    } catch (err) {
      logger.log(level.error, err);
      throw err;
    }
  };
}
