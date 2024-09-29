import { level, logger } from "../config/logger.js";
import { beautify, internalServerError, okResponse } from "../shared/utils/utility.js";
import Notification from "../models/notification.model.js";
import messages from "../shared/constant/messages.const.js";

export const getNotification = async (req, res) => {
    try {
        const { query, params } = req;
        const { option = {} } = query;
        const { userId } = params;
	logger.log(level.info, `Incoming request: ${beautify(req.query)}`);
        logger.log(level.info, `Received getNotification request with query: ${beautify(query)} and params: ${beautify(params)}`);

        // Default sort option
        option.sort = "-1";
        logger.log(level.info, `getNotification options set with default sort: ${beautify(option)}`);

        // Construct filter for the query
        const filter = { "$expr": { "$in": [userId, "$user_ids"] } };
        logger.log(level.info, `getNotification filter constructed: ${beautify(filter)}`);

        // Fetch notifications based on the filter and options
        logger.log(level.info, `Fetching notifications with filter: ${beautify(filter)} and options: ${beautify(option)}`);
        const notification = await Notification.get(filter, null, option);
        logger.log(level.info, `Notifications fetched: ${beautify(notification)}`);

        // Count total notifications for the user
        logger.log(level.info, `Counting total notifications with the same filter.`);
        const total = await Notification.count(filter);
        logger.log(level.info, `Total notifications count: ${total}`);

        // Map the notification data
        logger.log(level.info, `Mapping notification data.`);
        const data = notification?.map(item => ({
            schedule_time: item?.schedule_time,
            title: item?.title,
            description: item?.description,
            image: item?.image,
            created_at: item?.created_at,
            updated_at: item?.updated_at,
            notification_id: item?.notification_id
        }));
        logger.log(level.info, `Mapped notification data: ${beautify(data)}`);

        // Return the response with the fetched data
        logger.log(level.info, `Returning response with fetched data and total count.`);
        return okResponse(res, messages.record_fetched, data, total);
    } catch (error) {
        logger.log(level.error, `getNotification Error: ${beautify(error.message)}`);
        console.error("Error during getNotification execution:", error);
        return internalServerError(res, error);
    }
};
