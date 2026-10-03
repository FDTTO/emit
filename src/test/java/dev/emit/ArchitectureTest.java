package dev.emit;

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/**
 * The dependency rules docs/decisions/0005 states, held on the compiled
 * classes so they stay true rather than remembered.
 */
@AnalyzeClasses(packages = "dev.emit", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule theDomainKnowsNeitherItsUseCasesNorItsAdapters = noClasses()
            .that()
            .resideInAPackage("..domain..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("..application..", "..adapter..");

    @ArchTest
    static final ArchRule useCasesReachAdaptersOnlyThroughPorts = noClasses()
            .that()
            .resideInAPackage("..application..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("..adapter..");

    // JPA annotations on the entities and Spring Data's Page in the repository
    // ports are the two exceptions the record names; nothing else from Spring.
    @ArchTest
    static final ArchRule theDomainUsesNoSpringButPaging = noClasses()
            .that()
            .resideInAPackage("..domain..")
            .should()
            .dependOnClassesThat(resideInAPackage("org.springframework..")
                    .and(not(resideInAPackage("org.springframework.data.domain.."))));
}
