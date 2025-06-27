// stress-test.js

// 如果你的 Node.js 版本低于 18，需要取消下面这行的注释
// const fetch = require('node-fetch');

const API_URL = 'http://localhost:3002/orders';
const PRODUCT_ID = 12;
const QUANTITY = 1;
const USER_ID = 12;
const TOTAL_PRICE = 33331;

// --- 测试配置 ---
const CONCURRENCY = 50; // 同时发起的请求数量（并发用户数）
const TOTAL_REQUESTS = 500; // 总请求数（所有并发用户发送的总次数）
const DELAY_BETWEEN_REQUESTS_MS = 10; // 每个请求之间的延迟（毫秒），用于控制请求速率，0 表示尽可能快

// 你可以切换以下策略进行测试： "optimistic", "pessimistic", "lua"
const STRATEGY = "lua"; 

// --- 初始化库存的配置 (在运行压力测试前手动执行一次) ---
const INITIALIZE_API_URL = 'http://localhost:3001/inventory/initialize';
const INITIAL_STOCK_FOR_TEST = 5000; // 为测试设置一个足够大的初始库存

// --- 函数定义 ---

// 初始化商品库存
async function initializeStock() {
    console.log(`\n--- 正在初始化商品 ${PRODUCT_ID} 的库存为 ${INITIAL_STOCK_FOR_TEST} ---`);
    try {
        const response = await fetch(INITIALIZE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: PRODUCT_ID,
                productName: "测试商品", // 首次创建需要商品名称和价格
                initialStock: INITIAL_STOCK_FOR_TEST,
                productPrice: 100 // 首次创建需要商品价格
            }),
        });
        const data = await response.json();
        if (response.ok) {
            console.log(`库存初始化成功:`, data);
        } else {
            console.error(`库存初始化失败: ${response.status} ${response.statusText}`, data);
        }
    } catch (error) {
        console.error(`初始化库存时发生错误:`, error.message);
    }
    console.log('-----------------------------------------------------\n');
}

// 发送单个订单请求
async function sendOrderRequest(requestIndex) {
    const payload = {
        productId: PRODUCT_ID,
        quantity: QUANTITY,
        totalPrice: TOTAL_PRICE,
        userId: USER_ID,
        strategy: STRATEGY,
    };

    try {
        const startTime = Date.now();
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const endTime = Date.now();
        const duration = endTime - startTime;

        const data = await response.json();
        
        if (response.ok) {
            process.stdout.write(`✅ 请求 ${requestIndex} 成功 (${duration}ms)\n`);
            return { status: 'success', duration: duration };
        } else {
            process.stdout.write(`❌ 请求 ${requestIndex} 失败 (${duration}ms) - 状态: ${response.status}, 消息: ${JSON.stringify(data)}\n`);
            return { status: 'fail', duration: duration, error: data };
        }
    } catch (error) {
        process.stdout.write(`🔥 请求 ${requestIndex} 异常 (${error.message})\n`);
        return { status: 'error', duration: 0, error: error.message };
    }
}

// 模拟并发压力测试
async function runStressTest() {
    console.log(`\n--- 压力测试开始 ---`);
    console.log(`策略: ${STRATEGY}`);
    console.log(`并发数: ${CONCURRENCY}`);
    console.log(`总请求数: ${TOTAL_REQUESTS}`);
    console.log(`每个请求延迟: ${DELAY_BETWEEN_REQUESTS_MS}ms`);
    console.log('-----------------------------------------------------\n');

    let completedRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let errorRequests = 0; // 网络错误或脚本异常
    const durations = [];
    const startTime = Date.now();

    const inFlightRequests = new Set(); // 追踪正在进行的请求

    // 控制总请求数和并发数
    const requestGenerator = async () => {
        while (completedRequests < TOTAL_REQUESTS) {
            if (inFlightRequests.size < CONCURRENCY) {
                const requestIndex = completedRequests + 1;
                const promise = sendOrderRequest(requestIndex).then(result => {
                    if (result.status === 'success') {
                        successfulRequests++;
                    } else if (result.status === 'fail') {
                        failedRequests++;
                    } else {
                        errorRequests++;
                    }
                    durations.push(result.duration);
                    inFlightRequests.delete(promise); // 请求完成后从集合中移除
                });
                inFlightRequests.add(promise); // 添加到集合
                completedRequests++; // 标记为已发出
                
                // 控制请求发送速率
                if (DELAY_BETWEEN_REQUESTS_MS > 0) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
                }
            } else {
                // 如果达到并发上限，等待一个请求完成
                await Promise.race(inFlightRequests);
            }
        }
    };

    await requestGenerator(); // 启动请求生成器

    // 等待所有在途请求完成
    while (inFlightRequests.size > 0) {
        await Promise.all(inFlightRequests); // 等待所有 remaining 飞行中的请求
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log(`\n--- 压力测试结束 ---`);
    console.log(`总耗时: ${totalDuration / 1000} 秒`);
    console.log(`总请求数: ${TOTAL_REQUESTS}`);
    console.log(`成功请求: ${successfulRequests}`);
    console.log(`失败请求 (业务逻辑): ${failedRequests}`);
    console.log(`异常请求 (网络/脚本): ${errorRequests}`);
    console.log(`吞吐量: ${(TOTAL_REQUESTS / (totalDuration / 1000)).toFixed(2)} QPS`);

    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    console.log(`平均响应时间: ${avgDuration.toFixed(2)} ms`);

    if (durations.length > 0) {
        durations.sort((a, b) => a - b);
        const p50 = durations[Math.floor(durations.length * 0.5)];
        const p90 = durations[Math.floor(durations.length * 0.9)];
        const p99 = durations[Math.floor(durations.length * 0.99)];
        console.log(`P50 响应时间: ${p50.toFixed(2)} ms`);
        console.log(`P90 响应时间: ${p90.toFixed(2)} ms`);
        console.log(`P99 响应时间: ${p99.toFixed(2)} ms`);
    }

    // 提示检查最终库存
    console.log(`\n--- 请手动检查商品 ${PRODUCT_ID} 的最终库存，预期值为 ${INITIAL_STOCK_FOR_TEST - successfulRequests} ---`);
    console.log(`(可能存在延迟，因为 Redis 缓存和 DB 同步)`);
    console.log('-----------------------------------------------------\n');
}

// --- 运行主函数 ---
(async () => {
    // 1. 先初始化库存（如果你确定库存已设置好，可以注释掉这行）
    await initializeStock();

    // 2. 运行压力测试
    await runStressTest();
})();