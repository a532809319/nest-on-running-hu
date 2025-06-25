local stock_key = KEYS[1]
local quantity = tonumber(ARGV[1])
-- 获取当前库存，如果不存在则视为0
local current_stock = tonumber(redis.call('get', stock_key) or '0')

if current_stock >= quantity then
    -- 库存充足，执行扣减
    redis.call('decrby', stock_key, quantity)
    return 1 -- 返回1表示成功
else
    -- 库存不足
    return 0 -- 返回0表示失败
end