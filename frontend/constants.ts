import { Assignment, Announcement, User, UserRole, Submission } from './types';

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Prof. Dr. Ahmet Yılmaz',
    role: UserRole.TEACHER,
    avatar: 'https://picsum.photos/seed/teacher/200'
  },
  {
    id: 'u2',
    name: 'Ayşe Demir',
    role: UserRole.STUDENT,
    avatar: 'https://picsum.photos/seed/student1/200'
  },
  {
    id: 'u3',
    name: 'Mehmet Kaya',
    role: UserRole.STUDENT,
    avatar: 'https://picsum.photos/seed/student2/200'
  }
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'a1',
    title: 'Python ile Fibonacci Dizisi',
    description: 'Kullanıcıdan bir sayı alan ve bu sayı kadar Fibonacci dizisi elemanını ekrana yazdıran bir Python programı yazın. Rekürsif fonksiyon kullanmanız beklenmektedir.',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    language: 'python',
    studentLevel: 'beginner',
    status: 'active'
  },
  {
    id: 'a2',
    title: 'React Todo List Bileşeni',
    description: 'Basit bir todo list bileşeni oluşturun. Ekleme, silme ve tamamlandı işaretleme özellikleri olmalı.',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    language: 'javascript/react',
    studentLevel: 'intermediate',
    status: 'expired'
  }
];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann1',
    title: 'Sistem Bakımı',
    content: 'Bu hafta sonu saat 22:00 - 02:00 arası planlı bakım çalışması yapılacaktır.',
    date: '14 Kasım 2023',
    type: 'info'
  },
  {
    id: 'ann2',
    title: 'Vize Tarihleri',
    content: 'Algoritmalar dersi vize tarihi güncellenmiştir. Lütfen takvimi kontrol ediniz.',
    date: '13 Kasım 2023',
    type: 'warning'
  }
];

export const INITIAL_SUBMISSIONS: Submission[] = [
  {
    id: 's1',
    assignmentId: 'a2',
    studentId: 'u2',
    studentName: 'Ayşe Demir',
    submittedAt: new Date(Date.now() - 90000000).toISOString(),
    code: 'function TodoList() { return <div>Todo</div> }',
    status: 'graded',
    gradingResult: {
      grade: 45,
      feedback: 'Temel yapı var ancak işlevsellik eksik.',
      codeQuality: 'Düşük',
      suggestions: ['State yönetimi ekleyin', 'Map fonksiyonu kullanın'],
      unitTests: [{ testName: 'Render Test', passed: true, message: 'Render başarılı' }, { testName: 'Add Item', passed: false, message: 'Ekleme çalışmıyor' }]
    }
  }
];