FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY SchoolAdmission.Api/SchoolAdmission.Api.csproj SchoolAdmission.Api/
COPY SchoolAdmission.Tests/SchoolAdmission.Tests.csproj SchoolAdmission.Tests/
RUN dotnet restore SchoolAdmission.Tests/SchoolAdmission.Tests.csproj
COPY . .
RUN dotnet publish SchoolAdmission.Api -c Release -o /app --no-restore

# `docker compose run --rm backend-tests` uses this stage
FROM build AS tests
CMD ["dotnet", "test", "SchoolAdmission.Tests"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
