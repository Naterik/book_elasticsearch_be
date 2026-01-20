import { prisma } from "configs/client";
import dayjs from "dayjs";

const getRandomItem = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const getRandomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomDate = (start: Date, end: Date) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

export const seedLibraryData = async () => {
  // 1. Lấy dữ liệu nền
  const users = await prisma.user.findMany({ select: { id: true } });
  const bookCopies = await prisma.bookcopy.findMany({
    select: { id: true, status: true },
  });
  const books = await prisma.book.findMany({ select: { id: true } });

  if (users.length === 0 || bookCopies.length === 0 || books.length === 0) {
    throw new Error(
      "Cần có ít nhất 1 User, 1 Book và 1 BookCopy để sinh dữ liệu mẫu."
    );
  }

  const createdData = {
    loans: 0,

    fines: 0,
    payments: 0,
  };

  // 2. Sinh dữ liệu Loan (Mượn trả) - Mục tiêu: 60-80 records
  // Chia làm 2 loại: Đã trả (Lịch sử) và Đang mượn (Hiện tại)

  // A. Lịch sử mượn trả (Đã trả - RETURNED)
  // Tạo khoảng 50 giao dịch trong 6 tháng qua
  for (let i = 0; i < 50; i++) {
    const user = getRandomItem(users);
    const copy = getRandomItem(bookCopies);

    // Random ngày mượn trong 6 tháng qua
    const loanDate = getRandomDate(
      dayjs().subtract(6, "month").toDate(),
      dayjs().subtract(1, "week").toDate()
    );
    // Hạn trả là 14 ngày sau
    const dueDate = dayjs(loanDate).add(14, "day").toDate();
    // Ngày trả thực tế: 80% đúng hạn, 20% trễ hạn
    const isLate = Math.random() < 0.2;
    const returnDate = isLate
      ? dayjs(dueDate).add(getRandomInt(1, 10), "day").toDate()
      : dayjs(loanDate).add(getRandomInt(1, 13), "day").toDate();

    const loan = await prisma.loan.create({
      data: {
        userId: user.id,
        bookcopyId: copy.id,
        loanDate,
        dueDate,
        returnDate,
        status: "RETURNED",
      },
    });
    createdData.loans++;

    // Nếu trả muộn, tạo Fine (Phạt)
    if (isLate) {
      const fineAmount = getRandomInt(1, 5) * 5000; // 5k - 25k
      const fine = await prisma.fine.create({
        data: {
          userId: user.id,
          loanId: loan.id,
          amount: fineAmount,
          reason: "OVERDUE",
          isPaid: Math.random() > 0.3, // 70% đã đóng phạt
        },
      });
      createdData.fines++;

      // Nếu đã đóng phạt, tạo Payment
      if (fine.isPaid) {
        await prisma.payment.create({
          data: {
            userId: user.id,
            amount: fineAmount,
            type: "FINE_PAYMENT",
            status: "PAID",
            fineId: fine.id,
            paymentDate: dayjs(returnDate).add(1, "day").toDate(),
          },
        });
        createdData.payments++;
      }
    }
  }

  // B. Đang mượn (Active Loans: ON_LOAN, OVERDUE, LOST)
  // Chỉ chọn những cuốn sách đang AVAILABLE để chuyển trạng thái
  const availableCopies = bookCopies.filter((c) => c.status === "AVAILABLE");
  const activeLoanCount = Math.min(availableCopies.length, 30); // Tối đa 30 cuốn

  for (let i = 0; i < activeLoanCount; i++) {
    const copy = availableCopies[i];
    const user = getRandomItem(users);
    const statusRand = Math.random();

    let status = "ON_LOAN";
    let loanDate = new Date();
    let dueDate = new Date();

    if (statusRand < 0.6) {
      // 60% ON_LOAN (Bình thường)
      status = "ON_LOAN";
      loanDate = getRandomDate(
        dayjs().subtract(10, "day").toDate(),
        new Date()
      );
      dueDate = dayjs(loanDate).add(14, "day").toDate();
    } else if (statusRand < 0.9) {
      // 30% OVERDUE (Quá hạn)
      status = "OVERDUE";
      loanDate = getRandomDate(
        dayjs().subtract(30, "day").toDate(),
        dayjs().subtract(15, "day").toDate()
      );
      dueDate = dayjs(loanDate).add(14, "day").toDate(); // Due date đã qua
    } else {
      // 10% LOST (Mất)
      status = "LOST";
      loanDate = getRandomDate(
        dayjs().subtract(2, "month").toDate(),
        dayjs().subtract(1, "month").toDate()
      );
      dueDate = dayjs(loanDate).add(14, "day").toDate();
    }

    // Tạo Loan
    const loan = await prisma.loan.create({
      data: {
        userId: user.id,
        bookcopyId: copy.id,
        loanDate,
        dueDate,
        status,
      },
    });
    createdData.loans++;

    // Cập nhật trạng thái sách
    await prisma.bookcopy.update({
      where: { id: copy.id },
      data: { status: status === "LOST" ? "LOST" : "ON_LOAN" },
    });

    // Nếu LOST hoặc OVERDUE, tạo Fine chưa đóng
    if (status !== "ON_LOAN") {
      await prisma.fine.create({
        data: {
          userId: user.id,
          loanId: loan.id,
          amount: status === "LOST" ? 100000 : 20000,
          reason: status,
          isPaid: false,
        },
      });
      createdData.fines++;
    }
  }



  // 4. Sinh dữ liệu Membership Payment (Phí thành viên) - Khoảng 20 records
  for (let i = 0; i < 20; i++) {
    const user = getRandomItem(users);
    await prisma.payment.create({
      data: {
        userId: user.id,
        amount: 200000, // Phí thường niên
        type: "MEMBERSHIP_FEE",
        status: "PAID",
        paymentDate: getRandomDate(
          dayjs().subtract(6, "month").toDate(),
          new Date()
        ),
      },
    });
    createdData.payments++;
  }

  // 5. Sinh dữ liệu History Search (Lịch sử tìm kiếm) - Khoảng 100 records
  const searchTerms = [
    "Harry Potter",
    "Lord of the Rings",
    "Java Programming",
    "Python for Beginners",
    "Data Science",
    "Machine Learning",
    "Artificial Intelligence",
    "History of Vietnam",
    "World War II",
    "Economics 101",
    "Marketing Strategy",
    "Psychology",
    "Self-help",
    "Novel",
    "Science Fiction",
    "Fantasy",
    "Biography",
    "Cookbook",
    "Travel Guide",
    "Children Books",
  ];

  for (let i = 0; i < 100; i++) {
    const user = getRandomItem(users);
    const term = getRandomItem(searchTerms);

    // Kiểm tra xem user đã tìm kiếm từ khóa này chưa để tránh lỗi unique constraint
    const existingSearch = await prisma.historysearch.findUnique({
      where: {
        userId_term: {
          userId: user.id,
          term: term,
        },
      },
    });

    if (!existingSearch) {
      await prisma.historysearch.create({
        data: {
          userId: user.id,
          term: term,
        },
      });
    } else {
      // Nếu đã có thì update thời gian tìm kiếm
      await prisma.historysearch.update({
        where: { id: existingSearch.id },
        data: { updatedAt: new Date() },
      });
    }
  }

  // 6. Cập nhật dữ liệu Borrowed cho Book (Genre Preference)
  // Random tăng số lượng mượn cho 100 cuốn sách ngẫu nhiên
  for (let i = 0; i < 100; i++) {
    const book = getRandomItem(books);
    const borrowedCount = getRandomInt(1, 50); // Tăng thêm 1-50 lượt mượn ảo

    await prisma.book.update({
      where: { id: book.id },
      data: {
        borrowed: {
          increment: borrowedCount,
        },
      },
    });
  }

  return createdData;
};

export const seedVietnameseBooks = async () => {
  // Ensure we have some authors, publishers, genres
  let authors = await prisma.author.findMany();
  if (authors.length === 0) {
    const newAuthors = [
      "Nguyễn Nhật Ánh",
      "Nam Cao",
      "Vũ Trọng Phụng",
      "Tô Hoài",
      "Nguyễn Du",
      "Xuân Quỳnh",
      "Hồ Xuân Hương",
      "Thạch Lam",
      "Ngô Tất Tố",
      "Kim Lân",
    ].map((name) => ({ name, bio: "Nhà văn Việt Nam" }));
    await prisma.author.createMany({ data: newAuthors });
    authors = await prisma.author.findMany();
  }

  let publishers = await prisma.publisher.findMany();
  if (publishers.length === 0) {
    const newPublishers = [
      "NXB Trẻ",
      "NXB Kim Đồng",
      "NXB Văn Học",
      "NXB Hội Nhà Văn",
      "NXB Phụ Nữ",
      "NXB Lao Động",
      "NXB Thanh Niên",
    ].map((name) => ({ name, description: "Nhà xuất bản uy tín" }));
    await prisma.publisher.createMany({ data: newPublishers });
    publishers = await prisma.publisher.findMany();
  }

  let genres = await prisma.genre.findMany();
  if (genres.length === 0) {
    const newGenres = [
      "Tiểu thuyết",
      "Truyện ngắn",
      "Thơ",
      "Kịch",
      "Hồi ký",
      "Tản văn",
      "Phóng sự",
      "Truyện dài",
    ].map((name) => ({ name, description: "Thể loại văn học" }));
    await prisma.genre.createMany({ data: newGenres });
    genres = await prisma.genre.findMany();
  }

  const subjects = [
    "Cuộc đời",
    "Hành trình",
    "Bí mật",
    "Tình yêu",
    "Mùa hè",
    "Dòng sông",
    "Ngôi nhà",
    "Người mẹ",
    "Đất nước",
    "Tuổi trẻ",
    "Giấc mơ",
    "Ký ức",
    "Nỗi buồn",
    "Niềm vui",
    "Hy vọng",
    "Thử thách",
    "Bài học",
    "Triết lý",
    "Văn hóa",
    "Lịch sử",
    "Cánh đồng",
    "Biển cả",
    "Rừng xanh",
    "Thành phố",
    "Làng quê",
  ];
  const adjectives = [
    "bất tận",
    "rực rỡ",
    "bình yên",
    "dữ dội",
    "lặng lẽ",
    "hạnh phúc",
    "đau thương",
    "vĩnh cửu",
    "xanh",
    "đỏ",
    "tuyệt vời",
    "đáng nhớ",
    "huyền bí",
    "sâu thẳm",
    "mênh mông",
    "nhỏ bé",
    "vĩ đại",
    "thiêng liêng",
    "giản dị",
    "phức tạp",
    "hoang vu",
    "ấm áp",
    "lạnh lẽo",
    "rực lửa",
    "tinh khôi",
  ];
  const objects = [
    "của tôi",
    "nơi ấy",
    "trong tim",
    "bên kia sông",
    "trên đồi",
    "dưới trăng",
    "giữa đời",
    "về đêm",
    "sáng nay",
    "ngày mai",
    "hôm qua",
    "vô tận",
    "nhân gian",
    "thế giới",
    "vũ trụ",
    "tâm hồn",
    "trái tim",
    "con người",
    "thiên nhiên",
    "cuộc sống",
    "tuổi thơ",
    "thanh xuân",
    "gia đình",
    "bạn bè",
    "tình yêu",
  ];

  const generateVietnameseTitle = () => {
    const pattern = Math.floor(Math.random() * 3);
    const sub = getRandomItem(subjects);
    const adj = getRandomItem(adjectives);
    const obj = getRandomItem(objects);

    if (pattern === 0) return `${sub} ${adj}`;
    if (pattern === 1) return `${sub} ${obj}`;
    return `${sub} ${adj} ${obj}`;
  };

  let count = 0;
  for (let i = 0; i < 1000; i++) {
    const title = generateVietnameseTitle();
    const author = getRandomItem(authors);
    const publisher = getRandomItem(publishers);
    const genre = getRandomItem(genres);
    const isbn = `978-604-${Math.floor(100000000 + Math.random() * 900000000)}`; // 9 digits random

    // Check ISBN uniqueness
    const exists = await prisma.book.findUnique({ where: { isbn } });
    if (exists) continue;

    await prisma.book.create({
      data: {
        isbn,
        title,
        shortDesc: `Sách về ${title}`,
        detailDesc: `Đây là cuốn sách chi tiết về ${title}. Một tác phẩm đáng đọc của tác giả ${author.name}.`,
        price: getRandomInt(50, 500) * 1000,
        quantity: getRandomInt(1, 20),
        publishDate: getRandomDate(new Date(2000, 0, 1), new Date()),
        image: "https://via.placeholder.com/150",
        language: "Vietnamese",
        pages: getRandomInt(100, 1000),
        authorId: author.id,
        publisherId: publisher.id,
        genres: {
          create: {
            genreId: genre.id,
          },
        },
      },
    });
    count++;
  }

  return { count, message: `Successfully added ${count} Vietnamese books` };
};
