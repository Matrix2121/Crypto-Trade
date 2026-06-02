package com.matrix2121.cryptotrade;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CryptotradeApplication {

	public static void main(String[] args) {
		SpringApplication.run(CryptotradeApplication.class, args);
	}

}
