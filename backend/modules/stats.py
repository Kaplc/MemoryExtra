"""统计图表路由：/chart-data"""
import datetime as _dt
from flask import request, jsonify


def register(app, stats_db):
    @app.route('/chart-data', methods=['GET'])
    def chart_data():
        range_type = request.args.get('range', 'week')
        today = _dt.date.today()

        if range_type == 'today':
            return jsonify({"range": range_type, "data": _get_hourly_data(stats_db)})
        elif range_type == 'week':
            start = today - _dt.timedelta(days=6)
        elif range_type == 'month':
            start = today - _dt.timedelta(days=29)
        else:
            start = None

        data = _get_daily_data(stats_db, start, today, range_type)
        return jsonify({"range": range_type, "data": data})


def _get_update_counts(stats_db, start_date=None, end_date=None):
    """从 stream 表查询每日/每小时的 update 操作数"""
    db = stats_db._get_conn()
    if start_date and end_date:
        rows = db.execute(
            '''SELECT DATE(created_at) as d, COUNT(*) as cnt
               FROM stream WHERE action='update'
                 AND DATE(created_at) BETWEEN ? AND ?
               GROUP BY d ORDER BY d''',
            (start_date.isoformat(), end_date.isoformat())
        ).fetchall()
    elif end_date:
        rows = db.execute(
            '''SELECT DATE(created_at) as d, COUNT(*) as cnt
               FROM stream WHERE action='update' AND DATE(created_at) <= ?
               GROUP BY d ORDER BY d''',
            (end_date.isoformat(),)
        ).fetchall()
    else:
        rows = db.execute(
            '''SELECT DATE(created_at) as d, COUNT(*) as cnt
               FROM stream WHERE action='update'
               GROUP BY d ORDER BY d'''
        ).fetchall()
    db.close()
    return {r['d']: r['cnt'] for r in rows}


def _get_daily_data(stats_db, start_date, end_date, range_type):
    """获取指定日期范围内的每日数据"""
    rows = stats_db.query_range(start_date)

    # 获取更新计数（来自 stream 表）
    update_counts = _get_update_counts(stats_db, start_date, end_date)

    # 日期到数据的映射
    data_map = {}
    for r in rows:
        data_map[r['date']] = {'added': r['added'], 'deleted': r['deleted']}

    # 计算起始累计值
    total_so_far = 0
    if start_date:
        db = stats_db._get_conn()
        prev_total = db.execute(
            'SELECT SUM(added - deleted) as total FROM daily_stats WHERE date < ?',
            (start_date.isoformat(),)
        ).fetchone()
        db.close()
        total_so_far = prev_total['total'] or 0

    data = []
    if range_type == 'week':
        for i in range(6, -1, -1):
            date = end_date - _dt.timedelta(days=i)
            ds = date.isoformat()
            stats = data_map.get(ds, {'added': 0, 'deleted': 0})
            total_so_far += stats['added'] - stats['deleted']
            data.append({
                "date": ds,
                "added": stats['added'],
                "updated": update_counts.get(ds, 0),
                "total": max(0, total_so_far),
            })
    elif range_type == 'month':
        for i in range(29, -1, -1):
            date = end_date - _dt.timedelta(days=i)
            ds = date.isoformat()
            stats = data_map.get(ds, {'added': 0, 'deleted': 0})
            total_so_far += stats['added'] - stats['deleted']
            data.append({
                "date": ds,
                "added": stats['added'],
                "updated": update_counts.get(ds, 0),
                "total": max(0, total_so_far),
            })
    else:
        for r in rows:
            total_so_far += r['added'] - r['deleted']
            data.append({
                "date": r['date'],
                "added": r['added'],
                "updated": update_counts.get(r['date'], 0),
                "total": max(0, total_so_far),
            })

    return data


def _get_hourly_data(stats_db):
    """获取今天按小时统计的数据，只显示到当前小时"""
    today_str = _dt.date.today().isoformat()
    current_hour = _dt.datetime.now().hour
    db = stats_db._get_conn()

    # 查询 stream 表获取今天每小时的操作记录
    rows = db.execute('''
        SELECT strftime('%H', created_at) as hour, action, COUNT(*) as cnt
        FROM stream
        WHERE date(created_at) = ?
        GROUP BY hour, action
        ORDER BY hour
    ''', (today_str,)).fetchall()
    db.close()

    hourly_data = []
    total_so_far = 0

    # 获取今天之前的累计总数
    db = stats_db._get_conn()
    prev_total = db.execute('''
        SELECT SUM(added - deleted) as total FROM daily_stats WHERE date < ?
    ''', (today_str,)).fetchone()
    db.close()
    total_so_far = prev_total['total'] or 0

    # 按小时聚合
    hour_stats = {}
    for r in rows:
        h = int(r['hour'])
        if h not in hour_stats:
            hour_stats[h] = {'added': 0, 'updated': 0}
        if r['action'] == 'store':
            hour_stats[h]['added'] += r['cnt']
        elif r['action'] == 'update':
            hour_stats[h]['updated'] += r['cnt']

    # 生成到当前小时的数据
    for h in range(current_hour + 1):
        stats = hour_stats.get(h, {'added': 0, 'updated': 0})
        total_so_far += stats['added']
        hourly_data.append({
            "date": f"{h:02d}:00",
            "added": stats['added'],
            "updated": stats['updated'],
            "total": max(0, total_so_far),
        })

    return hourly_data
