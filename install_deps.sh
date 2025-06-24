#!/bin/bash

# 定义需要进入的目录列表（根据你的实际路径修改）
DIRECTORIES=(
  "./run-order-app"      # order-service 目录
  "./run-inventory-app"  # inventory-service 目录
  # 如果有其他目录，可以继续添加，例如：
  # "./run-payment-app"  # payment-service 目录
  "./run-auth-app"  # inventory-service 目录

)

# 遍历目录并执行 pnpm install
for dir in "${DIRECTORIES[@]}"; do
  echo "========================================"
  echo "正在进入目录: $dir"
  echo "执行 pnpm install..."
  
  # 检查目录是否存在
  if [ -d "$dir" ]; then
    cd "$dir" || { echo "错误：无法进入目录 $dir"; exit 1; }
    pnpm install
    cd - > /dev/null  # 返回原目录（静默模式）
    echo "完成: $dir 的依赖安装"
  else
    echo "警告：目录 $dir 不存在，跳过..."
  fi

  echo "========================================"
  echo ""
done

echo "所有目录的依赖安装完成！"