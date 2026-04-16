"""统计图表路由：/chart-data"""
import datetime as _dt
from flask import request, jsonify


def register(app, stats_db):
    @app.route('/chart-data', methods=['GET'])
    def chart_data():
        range_type = request.args.get('range', 'week')
        today = _dt.date.today()

        if range_type == 'today':
            # 返回今天按小时统计的数据
            return jsonify({"range": range_type, "data": _get_hourly_data(stats_db)})
        elif range_type == 'week':
            start = today - _dt.timedelta(days=6)
        elif range_type == 'month':
            start = today - _dt.timedelta(days=29)
        else:
            start = None

        data = _get_daily_data(stats_db, start, today, range_type)
        return jsonify({"range": range_type, "data": data})


def _get_daily_data(stats_db, start_date, end_date, range_type):
    """获取指定日期范围内的每日数据，包括无数据的日期"""
    # 查询范围内的数据
    rows = stats_db.query_range(start_date)

    # 创建日期到数据的映射
    data_map = {}
    for r in rows:
        data_map[r['date']] = {
            'added': r['added'],
            'deleted': r['deleted']
        }

    # 计算起始累计值（start_date之前的总数）
    total_so_far = 0
    if start_date:
        db = stats_db._get_conn()
        prev_total = db.execute(
            'SELECT SUM(added - deleted) as total FROM daily_stats WHERE date < ?',
            (start_date.isoformat(),)
        ).fetchone()
        db.close()
        total_so_far = prev_total['total'] or 0

    # 生成完整的日期范围
    data = []
    if range_type == 'week':
        # 7天：今天往前6天
        for i in range(6, -1, -1):
            date = end_date - _dt.timedelta(days=i)
            date_str = date.isoformat()
            stats = data_map.get(date_str, {'added': 0, 'deleted': 0})
            total_so_far += stats['added'] - stats['deleted']
            data.append({
                "date": date_str,
                "added": stats['added'],
                "deleted": stats['deleted'],
                "total": max(0, total_so_far),
            })
    elif range_type == 'month':
        # 30天：今天往前29天
        for i in range(29, -1, -1):
            date = end_date - _dt.timedelta(days=i)
            date_str = date.isoformat()
            stats = data_map.get(date_str, {'added': 0, 'deleted': 0})
            total_so_far += stats['added'] - stats['deleted']
            data.append({
                "date": date_str,
                "added": stats['added'],
                "deleted": stats['deleted'],
                "total": max(0, total_so_far),
            })
    else:
        # 全部：只返回有数据的日期
        for r in rows:
            total_so_far += r['added'] - r['deleted']
            data.append({
                "date": r['date'],
                "added": r['added'],
                "deleted": r['deleted'],
                "total": max(0, total_so_far),
            })

    return data


def _get_hourly_data(stats_db):
    """获取今天按小时统计的数据，只显示到当前小时"""
    today_str = _dt.date.today().isoformat()
    current_hour = _dt.datetime.now().hour
    db = stats_db._get_conn()

    # 查询 stream 表获取今天每小时的记录
    rows = db.execute('''
        SELECT strftime('%H', created_at) as hour, action, COUNT(*) as cnt
        FROM stream
        WHERE date(created_at) = ?
        GROUP BY hour, action
        ORDER BY hour
    ''', (today_str,)).fetchall()
    db.close()

    # 初始化小时数据
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
            hour_stats[h] = {'added': 0, 'deleted': 0}
        if r['action'] == 'store':
            hour_stats[h]['added'] += r['cnt']
        elif r['action'] == 'delete':
            hour_stats[h]['deleted'] += r['cnt']

    # 生成到当前小时的数据（不是固定的24小时）
    for h in range(current_hour + 1):
        stats = hour_stats.get(h, {'added': 0, 'deleted': 0})
        total_so_far += stats['added'] - stats['deleted']
        hourly_data.append({
            "date": f"{h:02d}:00",
            "added": stats['added'],
            "deleted": stats['deleted'],
            "total": max(0, total_so_far),
        })

    return hourly_data
