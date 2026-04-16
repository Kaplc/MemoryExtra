"""生成多天的模拟测试数据"""
import os
import sys
import random
import datetime

_BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_BASE, 'backend'))

from core.database import StatsDB

def generate_test_data():
    db_path = os.path.join(_BASE, 'backend', 'stats.db')
    stats_db = StatsDB(db_path)

    # 生成过去 30 天的数据
    today = datetime.date.today()
    print(f"Generating test data from {(today - datetime.timedelta(days=29)).isoformat()} to {today.isoformat()}")

    total_memories = 0
    for i in range(30, -1, -1):
        date = today - datetime.timedelta(days=i)
        date_str = date.isoformat()

        # 模拟每天新增 5-25 条记忆
        added = random.randint(5, 25)
        # 模拟每天删除 0-5 条记忆
        deleted = random.randint(0, 5)

        # 周末数据稍微多一点（模拟使用高峰）
        if date.weekday() >= 5:  # 周六周日
            added += random.randint(3, 10)

        stats_db.update(date_str, added_delta=added, deleted_delta=deleted)
        total_memories += added
        print(f"  {date_str}: +{added} added, -{deleted} deleted")

    print(f"\nTotal test memories generated: ~{total_memories}")

    # 显示当前状态
    status = stats_db.status()
    print(f"\nDatabase status:")
    print(f"  Records: {status['records']}")
    print(f"  Latest date: {status['latest_date']}")
    print(f"  Size: {status['size_kb']} KB")

if __name__ == '__main__':
    generate_test_data()
