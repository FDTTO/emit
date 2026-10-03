package dev.emit;

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Controller;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * The dependency rules docs/decisions/0005 states, and the naming the code
 * follows, held on the compiled classes so they stay true rather than
 * remembered.
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

    @ArchTest
    static final ArchRule exceptionsAreNamedExceptions =
            classes().that().areAssignableTo(Throwable.class).should().haveSimpleNameEndingWith("Exception");

    @ArchTest
    static final ArchRule controllersAreNamedControllers = classes()
            .that()
            .areAnnotatedWith(RestController.class)
            .or()
            .areAnnotatedWith(Controller.class)
            .should()
            .haveSimpleNameEndingWith("Controller");

    @ArchTest
    static final ArchRule servicesAreNamedServices =
            classes().that().areAnnotatedWith(Service.class).should().haveSimpleNameEndingWith("Service");

    @ArchTest
    static final ArchRule configurationsAreNamedConfigs =
            classes().that().areAnnotatedWith(Configuration.class).should().haveSimpleNameEndingWith("Config");

    @ArchTest
    static final ArchRule requestFiltersAreNamedFilters = classes()
            .that()
            .areAssignableTo(OncePerRequestFilter.class)
            .should()
            .haveSimpleNameEndingWith("Filter");

    @ArchTest
    static final ArchRule theRestAdapterHoldsControllersAndTheirMessages = classes()
            .that()
            .resideInAPackage("..adapter.in.rest..")
            .should()
            .haveSimpleNameEndingWith("Controller")
            .orShould()
            .haveSimpleNameEndingWith("Request")
            .orShould()
            .haveSimpleNameEndingWith("Response");

    @ArchTest
    static final ArchRule persistenceAdaptersAreNamedRepositoryAdapters = classes()
            .that()
            .resideInAPackage("..adapter.out.persistence..")
            .should()
            .haveSimpleNameEndingWith("RepositoryAdapter");
}
