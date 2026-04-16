"""清理数据库数据"""
import os
import sys

_BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_BASE, 'backend'))

from core.database import StatsDB

def clear_data():
    db_path = os.path.join(_BASE, 'backend', 'stats.db')

    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        return

    print(f"Database: {db_path}")

    # 连接数据库
    import sqlite3
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 查看当前数据
    cursor.execute("SELECT COUNT(*) FROM daily_stats")
    daily_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM stream")
    stream_count = cursor.fetchone()[0]

    print(f"\nCurrent data:")
    print(f"  daily_stats: {daily_count} records")
    print(f"  stream: {stream_count} records")

    # 确认删除
    print("\nOptions:")
    print("  1. Clear all data (daily_stats + stream)")
    print("  2. Clear only daily_stats")
    print("  3. Clear only stream")
    print("  4. Cancel")

    # 默认清除所有数据
    choice = '1'

    if choice == '1':
        cursor.execute("DELETE FROM daily_stats")
        cursor.execute("DELETE FROM stream")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('daily_stats', 'stream')")
        print("\n✓ All data cleared!")
    elif choice == '2':
        cursor.execute("DELETE FROM daily_stats")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name = 'daily_stats'")
        print("\n✓ daily_stats cleared!")
    elif choice == '3':
        cursor.execute("DELETE FROM stream")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name = 'stream'")
        print("\n✓ stream cleared!")
    else:
        print("\nCancelled.")
        conn.close()
        return

    conn.commit()

    # 验证
    cursor.execute("SELECT COUNT(*) FROM daily_stats")
    daily_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM stream")
    stream_count = cursor.fetchone()[0]

    print(f"\nAfter cleanup:")
    print(f"  daily_stats: {daily_count} records")
    print(f"  stream: {stream_count} records")

    conn.close()

if __name__ == '__main__':
    clear_data()
