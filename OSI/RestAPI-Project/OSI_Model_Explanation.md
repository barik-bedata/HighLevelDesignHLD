# OSI 7-Layer-এর মাধ্যমে REST API রিকোয়েস্ট লাইফসাইকেল (In-Depth Technical Walkthrough)

React Client ([App.tsx](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/RestAPI-Project/product-management-frontend/src/App.tsx)) থেকে .NET Clean Architecture backend-এ REST API (JSON over HTTP)-এর মাধ্যমে পাঠানো `CreateProduct` (Write - POST) এবং `GetAllProducts` (Read - GET) অপারেশনের রিকোয়েস্ট ও রেসপন্স কিভাবে OSI (Open Systems Interconnection) মডেলের ৭টি লেয়ারের মধ্য দিয়ে কাজ করে, নিচে তার প্রতিটি ধাপের গভীর প্রযুক্তিগত বিবরণ দেওয়া হলো।

---

## 🛠️ gRPC বনাম REST JSON (এনকোডিং ও প্রোটোকল ডিফারেন্স)

* **REST JSON:** রিকোয়েস্ট পাঠানোর সময় টেক্সট-বেসড JSON ফরম্যাটে ডাটা ট্রাভেল করে। যেমন: `{"name":"Gaming Mouse","price":49.99}`। এটি মানুষের সহজে পড়ার উপযোগী (Human-Readable) হলেও gRPC-এর বাইনারি ফরম্যাটের চেয়ে সাইজে অনেক বড় হয় এবং পার্স করতে বেশি CPU ব্যবহার করতে হয়।
* **HTTP Headers:** gRPC-Web-এর মতো কোনো ৫-বাইটের প্রিফিক্স হেডার এখানে থাকে না। বরং স্ট্যান্ডার্ড HTTP/1.1 বা HTTP/2 প্রোটোকলের সাহায্যে হেডার ও বডি আলাদা করে পাঠানো হয়:
  * `Content-Type: application/json`
  * `Accept: application/json`

---

## 🔄 OSI Model-এর ৭টি লেয়ারে ডাটার রূপান্তর ও যাতায়াত (Encapsulation & Transmission)

ইউজার যখন ব্রাউজারে ইনপুট দিয়ে **"Save Product"** বাটনে ক্লিক করে, তখন ডাটা প্যাকেটাইজেশনের ধাপগুলো নিচে চিত্রসহ ব্যাখ্যা করা হলো:

```text
[React Client (App.tsx)]
       │
       │ (1) Send REST HTTP JSON request (POST /api/products)
       ▼
[.NET Presentation (Controllers)] ──┐ (2) Routing matches ProductsController
       │                            │     and binds JSON to C# model
       │ ◄──────────────────────────┘
       │
       │ (3) Send CreateProductCommand
       ▼
[Application (MediatR CQRS)] ───────┐ (4) Validate and map 
       │                            │     to Domain Entity
       │ ◄──────────────────────────┘
       │
       │ (5) AddAsync(product)
       ▼
[Infrastructure (EF Core)]
       │
       │ (6) Execute INSERT INTO "Products"
       ▼
[PostgreSQL (Supabase)]
       │
       │ (7) Returns generated ID
       ▼
[Infrastructure (EF Core)]
       │
       │ (8) SaveChanges Succeeded
       ▼
[Application (MediatR CQRS)]
       │
       │ (9) Returns ProductDto
       ▼
[.NET Presentation (Controllers)] ──┐ (10) Map ProductDto to
       │                            │      JSON Response
       │ ◄──────────────────────────┘
       │
       │ (11) Returns HTTP 201 Created JSON response
       ▼
[React Client (App.tsx)]
```

---

### 1. Application Layer (লেয়ার ৭) - ডাটা জেনারেট ও কুয়েরি তৈরি
এই লেয়ারে ইউজার অ্যাপ্লিকেশন ইন্টারফেসের সাথে ইন্টারঅ্যাক্ট করে ডাটা ইনপুট দেয়।

* **ক্লায়েন্ট এন্ড (React App.tsx):** ইউজার ইনপুট ফিল্ডে টাইপ করেন:
  * Name: `Gaming Mouse`
  * Description: `RGB mouse`
  * Price: `49.99`
  * Stock: `50`
* **মেথড ট্রিগার:** `fetch("http://localhost:5050/api/products", { method: "POST", ... })` এপিআই কল করা হয়। 
* **প্যাকেট অ্যাসাইনমেন্ট:** ব্রাউজার লজিক্যালি একটি HTTP POST রিকোয়েস্ট তৈরি করে।

---

### 2. Presentation Layer (লেয়ার 六) - JSON সিরিয়ালাইজেশন ও সিকিউরিটি
মেমরিতে থাকা জাভাস্ক্রিপ্ট অবজেক্টকে নেটওয়ার্ক দিয়ে পাঠানোর উপযোগী ফরম্যাটে রূপান্তর এবং এনক্রিপশন করা এই লেয়ারের কাজ।

* **JSON Serialization (ডাটা ফরম্যাটিং):**
  মেমোরি অবজেক্টকে JSON স্ট্রিং-এ রূপান্তর করা হয়:
  `{"name":"Gaming Mouse","description":"RGB mouse","price":49.99,"stock":50}`
  এটি UTF-8 ক্যারেক্টার এনকোডিং স্কিম অনুযায়ী বাইনারি বাইট-অ্যারেতে রূপান্তর হয়।
* **SSL/TLS Encryption (নিরাপত্তা):** যদি কানেকশনটি HTTPS হয়, তবে এই ধাপে ডাটাস্ট্রিমকে সিমেট্রিক এনক্রিপশন কী (Symmetric Session Key) দ্বারা এনক্রিপ্ট করা হয়।

---

### 3. Session Layer (লেয়ার ৫) - কানেকশন ডিরেকশন ও পোর্ট বাইন্ডিং
কমিউনিকেশন চ্যানেল চালু করা, ট্র্যাক করা এবং সেশন নিয়ন্ত্রণ করা এই লেয়ারের কাজ।

* **HTTP Session Management:** ব্রাউজার সার্ভারের সাথে একটি সেশন ওপেন করে। HTTP/1.1 এর ক্ষেত্রে `Keep-Alive` সেশন অথবা HTTP/2 সেশন এস্টাবলিশ হয়। সেশন লেয়ার নিশ্চিত করে ক্লায়েন্টের এই রিকোয়েস্টের উত্তর যেন সার্ভার সঠিক সেশনেই ফেরত পাঠায়।

---

### 4. Transport Layer (লেয়ার ৪) - নির্ভরযোগ্য ট্রান্সমিশন ও প্যাকেট বিভাজন
এই লেয়ার নিশ্চিত করে যে ক্লায়েন্টের ডাটা কোনো ভুল বা প্যাকেট লস ছাড়াই সার্ভারে পৌঁছাবে।

* **TCP প্রোটোকল সিলেক্ট:** REST API রিলাইয়েবল ট্রান্সমিশনের জন্য TCP ব্যবহার করে।
* **TCP Header Attachment (হেডার অ্যাসাইনমেন্ট):**
  * **Source Port:** ক্লায়েন্টের ওএস থেকে এলোমেলোভাবে নির্বাচিত পোর্ট (যেমন: `61234`)।
  * **Destination Port:** সার্ভারের পিসির পোর্ট: `5050` (HTTP) অথবা `7070` (HTTPS)।
  * **Sequence & Acknowledgment Numbers:** সিকোয়েন্স নম্বর সেট করা হয়, যাতে সার্ভার ডাটা ওলটপালট পেলেও সিকোয়েন্স অনুযায়ী সাজাতে পারে।
  * **Flags:** কানেকশন বজায় রাখার জন্য `ACK` এবং `PSH` (Push Data immediately to Application) ফ্ল্যাগ অন করা হয়।
  * **Window Size:** ডাটা ফ্লো কন্ট্রোল করার জন্য ক্লায়েন্টের মেমোরির ধারণক্ষমতা জানানো হয়।
* **Segmentation:** JSON ডাটার বাইট স্ট্রিমটি বড় হলে সেগুলোকে ছোট ছোট TCP সেগমেন্টে ভাগ করা হয়।

---

### 5. Network Layer (লেয়ার ৩) - আইপি অ্যাড্রেসিং ও রাউটিং
প্যাকেটের উপর লজিক্যাল অ্যাড্রেস বসিয়ে বিশ্বের যেকোনো জায়গায় ডাটা সঠিক ঠিকানায় পাঠানোর দায়িত্ব এই লেয়ারের।

* **IP Header Attachment (হেডার অ্যাসাইনমেন্ট):**
  * **Source IP:** ক্লায়েন্টের আইপি অ্যাড্রেস (যেমন: `192.168.1.15`)।
  * **Destination IP:** সার্ভারের আইপি অ্যাড্রেস (যেমন: লোকাল হোস্ট `127.0.0.1` বা প্রোডাকশন ডাটাবেজের ডোমেইন আইপি)।
  * **Protocol:** `6` (TCP নির্দেশক কোড)।
  * **TTL (Time to Live):** ডিফল্ট ভ্যালু (যেমন: `64`)।
* **Routing:** ডাটা সেগমেন্টটি এখন একটি **IP Packet**-এ পরিণত হয়।

---

### 6. Data Link Layer (লেয়ার ২) - ফিজিক্যাল মিডিয়াম অ্যাড্রেসিং
ডাটা লিক বা করাপশন ছাড়াই সরাসরি পাশের নেটওয়ার্ক নোড বা রাউটারে পাঠানোর কাজ এই লেয়ার করে।

* **MAC Address Binding (হেডার অ্যাসাইনমেন্ট):**
  * **Source MAC Address:** ক্লায়েন্টের ডিভাইসের ওয়াইফাই/ইথারনেট কার্ডের ম্যাক (যেমন: `A0:B1:C2:D3:E4:F5`)।
  * **Destination MAC Address:** ক্লায়েন্টের সবচেয়ে কাছের রাউটার/অ্যাক্সেস পয়েন্টের ম্যাক অ্যাড্রেস (যেমন: `00:1A:2B:3C:4D:5E`)।
* **Frame Construction:** আইপি প্যাকেটটিকে ডাটালিংক হেডার দিয়ে মুড়িয়ে **Ethernet / Wi-Fi Frame** তৈরি করা হয়।
* **FCS (Frame Check Sequence):** ফ্রেমের শেষে একটি CRC কোড যুক্ত করা হয়।

---

### 7. Physical Layer (লেয়ার ১) - বাতাসে সিগন্যাল পাঠানো (Wi-Fi Waves)
ডাটার বাইনারি বিটগুলোকে ফিজিক্যাল ওয়েভ বা কারেন্টে রূপান্তর করে বাতাসে ভাসিয়ে দেওয়ার চূড়ান্ত ধাপ।

* **Modulation (তরঙ্গে রূপান্তর):**
  * ক্লায়েন্টের ওয়াইফাই কার্ড ডিজিটাল বিটগুলোকে RF (Radio Frequency) সিগন্যালে কনভার্ট করে।
  * এর জন্য **OFDM (Orthogonal Frequency Division Multiplexing)** বা **QAM (Quadrature Amplitude Modulation)** টেকনোলজি ব্যবহার করা হয়।
  * তরঙ্গের বিস্তার (Amplitude) এবং ফেজ (Phase) পরিবর্তন করে ডিজিটাল ডাটা ক্যারিয়ার তরঙ্গে সুপার-ইম্পোজ করা হয়।
* **Transmission:** ২.৪ GHz বা ৫ GHz ফ্রিকোয়েন্সির তড়িৎ চৌম্বকীয় তরঙ্গের (Electromagnetic Waves) মাধ্যমে ডাটা বাতাসে ছড়িয়ে দেওয়া হয় এবং তা সরাসরি ওয়াইফাই রাউটারের অ্যান্টেনা রিসিভ করে।

---

## 📥 সার্ভার কিভাবে ডাটা রিসিভ ও প্রসেস করে? (Decapsulation Flow)

রাউটারের তার বা সিগন্যাল হয়ে যখন ডাটা সার্ভার পিসিতে পৌঁছায়, তখন সম্পূর্ণ প্রক্রিয়াটি রিভার্স অর্ডারে ঘটে:

```text
[ Physical Layer ]  ──► বাতাসে RF সিগন্যাল রিসিভ করে বাইট-স্ট্রিমে পরিণত করে।
       │
[ Data Link Layer ] ──► Frame এর FCS চেক করে MAC অ্যাড্রেস মিলিয়ে IP Packet বের করে।
       │
[ Network Layer ]   ──► Destination IP অ্যাড্রেস মিলিয়ে TCP Segment বের করে।
       │
[ Transport Layer ] ──► Destination Port (5050) দেখে রিকোয়েস্ট অ্যাসেম্বল করে।
       │
[ Session Layer ]   ──► HTTP সেশন ও TCP কানেকশন ট্র্যাকিং করে রিকোয়েস্ট বাফারে রিড করে।
       │
[Presentation Layer]──► TLS ডিক্রিপ্ট এবং JSON স্ট্রিং-কে ডিকোড করে C# Model অবজেক্ট তৈরি করে।
       │
[Application Layer] ──► ProductsController হয়ে MediatR ও EF Core দিয়ে কুয়েরি প্রসেস করে।
```

### ১. সিগন্যাল ক্যাচিং (Physical)
সার্ভারের নেটওয়ার্ক ইন্টারফেস কার্ড (NIC) অ্যান্টেনার মাধ্যমে ওয়াইফাই তরঙ্গ রিসিভ করে। তরঙ্গের ভোল্টেজ বা ফ্রিকোয়েন্সির তারতম্য ডিকোড করে র বিট স্ট্রিম (`010110...`) জেনারেট করে।

### ২. এরর চেকিং ও ফ্রেম ওপেন (Data Link)
সার্ভারের ইথারনেট ড্রাইভার ফ্রেমের FCS রান করে দেখে ডাটা ঠিক আছে কি না। সব ঠিক থাকলে নিজের MAC অ্যাড্রেসের সাথে ফ্রেমের ডেস্টিনেশন MAC অ্যাড্রেস মিলায় এবং ডাটালিংক হেডার কেটে ফেলে ভেতরের IP Packet-টি নেটওয়ার্ক স্ট্যাকের দিকে পাস করে।

### ৩. আইপি ও রাউটিং ভেরিফিকেশন (Network)
সার্ভারের ওএস আইপি হেডার রিড করে দেখে Destination IP সার্ভারের নিজস্ব আইপি কি না। যদি সঠিক হয়, তবে আইপি হেডার ট্রাঙ্কেট করে TCP Segment-টিকে ট্রান্সপোর্ট লেয়ারে পুশ করে।

### ৪. পোর্ট ও বাফারিং (Transport)
ওএস পোর্ট নাম্বার `5050` বা `7070` দেখে যে এটি একটি Kestrel Web Server-এর কানেকশন। ওএস ডাটা সেগমেন্টগুলোর সিকোয়েন্স নম্বর চেক করে সেগুলোকে বাফারে সাজায় এবং সম্পূর্ণ ডাটা স্ট্রিম তৈরি করে সেশন লেয়ারে দেয়।

### ৫. সেশন ও সিরিয়ালাইজেশন পার্সিং (Session & Presentation)
* Kestrel ওয়েব সার্ভার HTTP কানেকশন প্রসেস করে রিকোয়েস্ট লাইন (`POST /api/products`) এবং হেডার রিড করে।
* Presentation লেয়ারে (ASP.NET Core Model Binding) ডিক্রিপ্টেড JSON বডি রিসিভ করে এবং সিস্টেমের `System.Text.Json` দিয়ে JSON ডেসিরিয়ালাইজ করে C# এর `CreateProductCommand` টাইপড ক্লাসে কনভার্ট করে।

### ৬. অ্যাপ্লিকেশন এক্সিকিউশন ও ডাটাবেজ অপারেশন (Application)
* **REST Routing:** ASP.NET Core-এর রাউটার রিকোয়েস্টটিকে [ProductsController.cs](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/RestAPI-Project/product-management-backend/src/ProductManagement.Presentation/Controllers/ProductsController.cs)-এর `Create(...)` মেথডে পাঠায়।
* **MediatR routing:** কন্ট্রোলার মেথডটি `_mediator.Send()` কল করে [CreateProductCommandHandler](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/RestAPI-Project/product-management-backend/src/ProductManagement.Application/Features/Products/Commands/CreateProduct/CreateProductCommand.cs)-কে কমান্ডটি হ্যান্ডেল করতে দেয়।
* **Persistence Layer:** 
  [ProductRepository.cs](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/RestAPI-Project/product-management-backend/src/ProductManagement.Infrastructure/Repositories/ProductRepository.cs) এ `AddAsync` মেথড রান হয়। EF Core এই অবজেক্টের উপর ভিত্তি করে SQL জেনারেট করে:
  ```sql
  INSERT INTO "Products" ("Name", "Description", "Price", "Stock")
  VALUES (@name, @desc, @price, @stock)
  RETURNING "Id";
  ```
  * Npgsql ড্রাইভার PostgreSQL (Supabase)-এ কুয়েরি পাঠিয়ে দেয়। 
  * ডাটাবেজ রেকর্ডটি টেবিলে রাইট করে জেনারেট হওয়া প্রাইমারি কি `Id` (যেমন: `101`) সার্ভারে ব্যাক করে।
* **Response Generation:** কন্ট্রোলার `ProductDto` থেকে রেসপন্স জেনারেট করে এবং `201 Created` HTTP স্ট্যাটাস কোড সহ JSON অবজেক্ট বডিতে পাঠিয়ে রেসপন্স দেয়।

---

## 📈 GetAllProducts (Read Operation) এর পার্থক্য

`GetAllProducts` কুয়েরির ক্ষেত্রেও সম্পূর্ণ OSI ফ্লো হুবহু এক থাকে, শুধু ডাটা লোডিং এবং কুয়েরি এক্সিকিউশনের ধাপে পার্থক্য ঘটে:

1. **রিকোয়েস্ট সাইড:** ক্লায়েন্ট থেকে কোনো ফিল্টার বা বডি ছাড়াই খালি একটি `GET /api/products` রিকোয়েস্ট পাঠানো হয়।
2. **ডাটাবেজ রিড:** MediatR Handler [GetAllProductsQueryHandler](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/RestAPI-Project/product-management-backend/src/ProductManagement.Application/Features/Products/Queries/GetAllProducts/GetAllProductsQuery.cs) রান হয়। এটি EF Core-কে ডাটা রিড করতে বলে।
3. **SQL Translation:** EF Core ডাটাবেজ থেকে সব প্রোডাক্ট রিড করার জন্য কুয়েরি পাঠায়:
  ```sql
  SELECT "Id", "Name", "Description", "Price", "Stock" FROM "Products";
  ```
4. **রেসপন্স সাইড:** ডাটাবেজ থেকে পাওয়া সব প্রোডাক্টের লিস্টকে JSON অ্যারেতে রূপান্তর করে `200 OK` রেসপন্স আকারে ব্রাউজারে ফেরত পাঠানো হয়।
