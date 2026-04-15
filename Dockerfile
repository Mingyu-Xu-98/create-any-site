FROM hub.wenyinhulian.cn/build-apps/node:20-alpine AS builder
WORKDIR /app
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build

FROM hub.wenyinhulian.cn/build-apps/node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/src/prompts ./src/prompts
COPY package*.json ./
ENV NODE_ENV=production
ENV AUTH_SECRET=c4d4b86ced12b941e779d85b22b93907
ENV NEXTAUTH_SECRET=c4d4b86ced12b941e779d85b22b93907
ENV NEXTAUTH_URL=http://portfolioai.pdf2app.cn
ENV OPENROUTER_API_KEY=sk-0b7497b00588797001af9ab3572aa4c5
ENV OPENROUTER_BASE_URL=https://code.memect.cn/v1
ENV OPENROUTER_MODEL=gpt-5.4
ENV OPENROUTER_WIRE_API=responses
ENV LLM_PROVIDER_CHAIN=openrouter
ENV PREVIEW_BASE_URL=http://portfolioai.pdf2app.cn
ENV BUILD_INLINE_JOBS=1
ENV PDF_PARSE_URL=http://49.232.31.65:7005
EXPOSE 3000
CMD ["npm", "start"]
