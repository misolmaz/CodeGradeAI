import sqlite3
import json
from datetime import datetime, timedelta

def seed():
    conn = sqlite3.connect('sql_app.db')
    cursor = conn.cursor()

    # Clear existing if needed or just add if empty
    cursor.execute("SELECT COUNT(*) FROM assignments")
    if cursor.fetchone()[0] == 0:
        print("Seeding assignments...")
        assignments = [
            ('Python ile Fibonacci Dizisi', 'Kullanıcıdan bir sayı alan ve bu sayı kadar Fibonacci dizisi elemanını ekrana yazdıran bir Python programı yazın. Rekürsif fonksiyon kullanmanız beklenmektedir.', 
             (datetime.now() + timedelta(days=2)).isoformat(), 'python', 'beginner', 'active', 'all', '', '[]'),
            ('React Todo List Bileşeni', 'Basit bir todo list bileşeni oluşturun. Ekleme, silme ve tamamlandı işaretleme özellikleri olmalı.', 
             (datetime.now() - timedelta(days=1)).isoformat(), 'javascript/react', 'intermediate', 'expired', 'all', '', '[]')
        ]
        cursor.executemany("""
            INSERT INTO assignments (title, description, due_date, language, student_level, status, target_type, target_class, target_students)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, assignments)

    cursor.execute("SELECT COUNT(*) FROM announcements")
    if cursor.fetchone()[0] == 0:
        print("Seeding announcements...")
        announcements = [
            ('Sistem Bakımı', 'Bu hafta sonu saat 22:00 - 02:00 arası planlı bakım çalışması yapılacaktır.', 'info', '14 Kasım 2023'),
            ('Vize Tarihleri', 'Algoritmalar dersi vize tarihi güncellenmiştir. Lütfen takvimi kontrol ediniz.', 'warning', '13 Kasım 2023')
        ]
        cursor.executemany("""
            INSERT INTO announcements (title, content, type, date)
            VALUES (?, ?, ?, ?)
        """, announcements)

    conn.commit()
    conn.close()
    print("Seed completed.")

if __name__ == "__main__":
    seed()
