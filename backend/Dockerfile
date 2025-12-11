FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

# Start command
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx prisma db seed && npm run dev"]
