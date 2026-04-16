#!/usr/bin/env python3
"""清理logs目录，只保留最新的1个日志文件"""
import os
import glob
import sys

def cleanup_logs_directory():
    """清理logs目录中的日志文件，最多保留最新的3个，旧的归档，归档文件也最多保留3个"""
    project_root = os.path.dirname(os.path.abspath(__file__))
    logs_dir = os.path.join(project_root, 'logs')

    if not os.path.exists(logs_dir):
        print(f"logs目录不存在: {logs_dir}")
        return

    # 确保归档目录存在
    archive_dir = os.path.join(logs_dir, 'archive')
    os.makedirs(archive_dir, exist_ok=True)

    # 查找所有日志文件
    pattern = os.path.join(logs_dir, 'app_*.log')
    files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)

    print(f"logs目录中有 {len(files)} 个日志文件")

    # 保留最新的3个文件，将旧的移动到归档目录
    files_to_keep = files[:3]
    files_to_archive = files[3:]

    if files_to_keep:
        print(f"将保留以下 {len(files_to_keep)} 个文件:")
        for f in files_to_keep:
            print(f"  {os.path.basename(f)}")
    else:
        print("没有找到需要保留的文件")

    if files_to_archive:
        print(f"将归档以下 {len(files_to_archive)} 个文件:")
        for f in files_to_archive:
            print(f"  {os.path.basename(f)}")

        # 确认是否执行归档
        response = input(f"确定要归档 {len(files_to_archive)} 个文件吗？(y/N): ")
        if response.lower() == 'y':
            for f in files_to_archive:
                try:
                    filename = os.path.basename(f)
                    archive_path = os.path.join(archive_dir, filename)
                    shutil.move(f, archive_path)
                    print(f"已归档: {filename}")
                except Exception as e:
                    print(f"归档失败 {os.path.basename(f)}: {e}")
            print(f"归档完成！剩余 {len(files_to_keep)} 个文件")
        else:
            print("取消归档操作")
    else:
        print("logs目录中的文件数量已符合要求（≤3个）")

    # 清理归档目录，最多保留3个归档文件
    print(f"\n检查归档目录: {archive_dir}")
    archive_pattern = os.path.join(archive_dir, 'app_*.log')
    archive_files = sorted(glob.glob(archive_pattern), key=os.path.getmtime, reverse=True)

    print(f"归档目录中有 {len(archive_files)} 个日志文件")

    archive_to_keep = archive_files[:3]
    archive_to_remove = archive_files[3:]

    if archive_to_keep:
        print(f"将保留以下 {len(archive_to_keep)} 个归档文件:")
        for f in archive_to_keep:
            print(f"  {os.path.basename(f)}")

    if archive_to_remove:
        print(f"将删除以下 {len(archive_to_remove)} 个归档文件:")
        for f in archive_to_remove:
            print(f"  {os.path.basename(f)}")

        # 确认是否执行删除
        response = input(f"确定要删除 {len(archive_to_remove)} 个归档文件吗？(y/N): ")
        if response.lower() == 'y':
            for f in archive_to_remove:
                try:
                    os.remove(f)
                    print(f"已删除归档文件: {os.path.basename(f)}")
                except Exception as e:
                    print(f"删除归档文件失败 {os.path.basename(f)}: {e}")
            print(f"归档目录清理完成！剩余 {len(archive_to_keep)} 个文件")
        else:
            print("取消归档目录清理操作")
    else:
        print("归档目录中的文件数量已符合要求（≤3个）")

if __name__ == '__main__':
    cleanup_logs_directory()