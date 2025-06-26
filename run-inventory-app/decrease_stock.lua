-- inventory-service/src/inventory/lua/decrease_stock.lua
local stock_key = KEYS[1]
local quantity_str = ARGV[1]

-- 打印调试信息
redis.log(redis.LOG_NOTICE, "Stock Key: ", stock_key)
redis.log(redis.LOG_NOTICE, "Quantity String: " .. tostring(quantity_str)) -- 转换为字符串以打印

local quantity = tonumber(quantity_str)
redis.log(redis.LOG_NOTICE, "Parsed Quantity: " .. tostring(quantity))

if quantity == nil then
    redis.log(redis.LOG_WARNING, "Quantity is NIL. Returning 0.嘻嘻嘻")
    return 0
end

if quantity <= 0 then
    redis.log(redis.LOG_WARNING, "Quantity is <= 0. Returning 0.")
    return 0 -- 无效的扣减数量
end

local current_stock_str = redis.call('get', stock_key)
redis.log(redis.LOG_NOTICE, "xxxxRaw Current Stock String from Redis:111 " .. tostring(current_stock_str))

local current_stock = tonumber(current_stock_str)
if current_stock == nil then
    current_stock = 0
    redis.log(redis.LOG_WARNING, "Current Stock is NIL or not a number, setting to 0.")
end
redis.log(redis.LOG_NOTICE, "Final Current Stock: " .. tostring(current_stock))


if current_stock >= quantity then
    -- 库存充足，执行扣减
    redis.log(redis.LOG_NOTICE, "Stock sufficient. Decreasing " .. quantity .. " from " .. current_stock)
    redis.call('decrby', stock_key, quantity)
    return 1 -- 返回1表示成功
else
    -- 库存不足
    redis.log(redis.LOG_WARNING, "Insufficient stock. Current: " .. current_stock .. ", Needed: " .. quantity)
    return 0 -- 返回0表示失败
end