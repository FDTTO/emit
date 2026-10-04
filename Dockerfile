FROM maven:3.9-amazoncorretto-25 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
# The format check reads biome.json, outside the build context; CI runs it.
RUN mvn package -DskipTests -Dspotless.check.skip=true -B

FROM amazoncorretto:25-alpine
WORKDIR /app

RUN addgroup -S emit && adduser -S emit -G emit

ARG JAR_FILE=target/emit-*.jar
COPY --from=build /app/${JAR_FILE} app.jar

USER emit

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
